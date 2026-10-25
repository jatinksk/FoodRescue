require("dotenv").config();

const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));


// =====================================================
// DATABASE CONNECTION
// =====================================================


const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
  ca: process.env.DB_SSL_CA.replace(/\\n/g, '\n'),
  rejectUnauthorized: true
},
  waitForConnections: true,
  connectionLimit: 10
});



// =====================================================
// AUTHENTICATION MIDDLEWARE
// =====================================================

function authenticateToken(req, res, next) {

  const authHeader = req.headers["authorization"];

  const token =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

  if (!token) {
    return res.status(401).json({
      error: "Authentication token required"
    });
  }

  jwt.verify(
    token,
    process.env.JWT_SECRET,
    (error, user) => {

      if (error) {
        return res.status(403).json({
          error: "Invalid or expired token"
        });
      }

      req.user = user;

      next();
    }
  );
}


// =====================================================
// LOGIN API
// =====================================================

app.post("/api/login", async (req, res) => {

  try {

    const {
      email,
      password
    } = req.body;

    if (!email || !password) {

      return res.status(400).json({
        error: "Email and password are required"
      });

    }

    const [rows] =
      await pool.query(
        `SELECT
          user_id,
          name,
          email,
          password,
          role,
          phone
        FROM users
        WHERE email = ?`,
        [email]
      );

    if (rows.length === 0) {

      return res.status(401).json({
        error: "Invalid email or password"
      });

    }

    const user = rows[0];

    const passwordMatch =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!passwordMatch) {

      return res.status(401).json({
        error: "Invalid email or password"
      });

    }

    const token =
      jwt.sign(
        {
          user_id: user.user_id,
          role: user.role
        },
        process.env.JWT_SECRET,
        {
          expiresIn: "2h"
        }
      );

    res.json({

      message: "Login successful",

      token,

      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone
      }

    });

  } catch (e) {

    console.error(
      "Login error:",
      e
    );

    res.status(500).json({
      error: e.message
    });

  }

});


// =====================================================
// STATISTICS API
// =====================================================

app.get("/api/stats", async (req, res) => {

  try {

    const [[{ donations }]] =
      await pool.query(
        `SELECT COUNT(*) donations
         FROM food_listings`
      );

    const [[{ servings }]] =
      await pool.query(
        `SELECT
          COALESCE(SUM(quantity),0) servings
         FROM food_listings`
      );

    const [[{ pickups }]] =
      await pool.query(
        `SELECT COUNT(*) pickups
         FROM pickup_requests
         WHERE request_status = 'completed'`
      );

    const [[{ volunteers }]] =
      await pool.query(
        `SELECT COUNT(*) volunteers
         FROM users
         WHERE role = 'volunteer'`
      );

    res.json({

      donations,
      servings,
      pickups,
      volunteers

    });

  } catch (e) {

    res.status(500).json({
      error: e.message
    });

  }

});


// =====================================================
// GET AVAILABLE FOOD
// =====================================================

app.get("/api/food", async (req, res) => {

  try {

    const [rows] =
      await pool.query(
        `SELECT *
         FROM available_food
         ORDER BY expiry_datetime ASC`
      );

    res.json(rows);

  } catch (e) {

    res.status(500).json({
      error: e.message
    });

  }

});


// =====================================================
// ADD FOOD LISTING
// =====================================================

app.post("/api/food", async (req, res) => {

  try {

    const {
      donor_id = 2,
      category_id,
      food_name,
      quantity,
      unit,
      description,
      pickup_location,
      expiry_datetime
    } = req.body;

    if (
      !category_id ||
      !food_name ||
      !quantity ||
      !unit ||
      !pickup_location ||
      !expiry_datetime
    ) {

      return res.status(400).json({
        error: "Please fill all required food details"
      });

    }

    await pool.query(

      `INSERT INTO food_listings
      (
        donor_id,
        category_id,
        food_name,
        quantity,
        unit,
        description,
        pickup_location,
        expiry_datetime
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,

      [
        donor_id,
        category_id,
        food_name,
        quantity,
        unit,
        description,
        pickup_location,
        expiry_datetime
      ]

    );

    res.json({

      message:
        "Food listing created successfully"

    });

  } catch (e) {

    console.error(
      "Add food error:",
      e
    );

    res.status(400).json({
      error: e.message
    });

  }

});


// =====================================================
// REQUEST PICKUP
// =====================================================

app.post("/api/pickups", async (req, res) => {

  try {

    const {
      food_id,
      volunteer_id
    } = req.body;

    if (!food_id) {

      return res.status(400).json({
        error: "Food ID is required"
      });

    }

    /*
      If the frontend sends a logged-in JWT,
      use the user ID from the token.

      Otherwise use the volunteer_id currently
      sent by the existing volunteer dashboard.
    */

    let actualVolunteerId =
      volunteer_id;

    const authHeader =
      req.headers["authorization"];

    if (
      authHeader &&
      authHeader.startsWith("Bearer ")
    ) {

      const token =
        authHeader.split(" ")[1];

      try {

        const decoded =
          jwt.verify(
            token,
            process.env.JWT_SECRET
          );

        actualVolunteerId =
          decoded.user_id;

      } catch (error) {

        return res.status(403).json({
          error: "Invalid or expired token"
        });

      }

    }

    if (!actualVolunteerId) {

      return res.status(400).json({
        error: "Volunteer ID is required"
      });

    }

    /*
      Check that the volunteer exists.
    */

    const [volunteerRows] =
      await pool.query(
        `SELECT user_id
         FROM users
         WHERE user_id = ?
         AND role = 'volunteer'`,
        [actualVolunteerId]
      );

    if (volunteerRows.length === 0) {

      return res.status(400).json({
        error: "Invalid volunteer account"
      });

    }

    /*
      Check that the food exists.
    */

    const [foodRows] =
      await pool.query(
        `SELECT food_id, status
         FROM food_listings
         WHERE food_id = ?`,
        [food_id]
      );

    if (foodRows.length === 0) {

      return res.status(404).json({
        error: "Food listing not found"
      });

    }

    /*
      Prevent duplicate active pickup requests.
    */

    const [existingRequests] =
      await pool.query(
        `SELECT request_id
         FROM pickup_requests
         WHERE food_id = ?
         AND request_status IN ('pending','approved')`,
        [food_id]
      );

    if (existingRequests.length > 0) {

      return res.status(400).json({
        error:
          "This food already has an active pickup request"
      });

    }

    /*
      Create pickup request.
    */

    await pool.query(

      `INSERT INTO pickup_requests
      (
        food_id,
        volunteer_id,
        request_status
      )
      VALUES (?, ?, 'pending')`,

      [
        food_id,
        actualVolunteerId
      ]

    );

    /*
      Mark food as requested.
    */

    await pool.query(

      `UPDATE food_listings
       SET status = 'requested'
       WHERE food_id = ?`,

      [food_id]

    );

    res.json({

      message:
        "Pickup request submitted"

    });

  } catch (e) {

    console.error(
      "Pickup request error:",
      e
    );

    res.status(400).json({
      error: e.message
    });

  }

});


// =====================================================
// GET MY PICKUPS
// =====================================================

app.get(
  "/api/pickups",
  authenticateToken,
  async (req, res) => {

    try {

      /*
        Only volunteers should access this endpoint.
      */

      if (req.user.role !== "volunteer") {

        return res.status(403).json({
          error: "Volunteer access required"
        });

      }

      const [rows] =
        await pool.query(

          `SELECT
            pr.request_id,
            pr.food_id,
            pr.volunteer_id,
            pr.request_status,
            pr.requested_at,
            pr.completed_at,

            fl.food_name,
            fl.quantity,
            fl.unit,
            fl.description,
            fl.pickup_location,
            fl.expiry_datetime,

            fc.category_name,

            u.name AS donor_name

          FROM pickup_requests pr

          INNER JOIN food_listings fl
            ON pr.food_id = fl.food_id

          INNER JOIN food_categories fc
            ON fl.category_id = fc.category_id

          INNER JOIN users u
            ON fl.donor_id = u.user_id

          WHERE pr.volunteer_id = ?

          ORDER BY
            pr.requested_at DESC`,

          [req.user.user_id]

        );

      res.json(rows);

    } catch (e) {

      console.error(
        "Get pickups error:",
        e
      );

      res.status(500).json({
        error: e.message
      });

    }

  }
);


// =====================================================
// COMPLETE PICKUP
// =====================================================

app.put(
  "/api/pickups/:id/complete",
  authenticateToken,
  async (req, res) => {

    try {

      /*
        Only volunteers can complete pickups.
      */

      if (req.user.role !== "volunteer") {

        return res.status(403).json({
          error: "Volunteer access required"
        });

      }

      const requestId =
        Number(req.params.id);

      if (!requestId) {

        return res.status(400).json({
          error: "Invalid pickup request ID"
        });

      }

      /*
        Find the pickup and make sure it belongs
        to the logged-in volunteer.
      */

      const [rows] =
        await pool.query(

          `SELECT
            request_id,
            food_id,
            request_status

           FROM pickup_requests

           WHERE request_id = ?
           AND volunteer_id = ?`,

          [
            requestId,
            req.user.user_id
          ]

        );

      if (rows.length === 0) {

        return res.status(404).json({
          error: "Pickup request not found"
        });

      }

      const pickup =
        rows[0];

      if (
        pickup.request_status ===
        "completed"
      ) {

        return res.status(400).json({
          error:
            "This pickup is already completed"
        });

      }

      if (
        pickup.request_status ===
        "rejected"
      ) {

        return res.status(400).json({
          error:
            "This pickup request was rejected"
        });

      }

      /*
        Complete the pickup.
      */

      await pool.query(

        `UPDATE pickup_requests

         SET
           request_status = 'completed',
           completed_at = CURRENT_TIMESTAMP

         WHERE request_id = ?
         AND volunteer_id = ?`,

        [
          requestId,
          req.user.user_id
        ]

      );

      /*
        Mark the food listing as completed.
      */

      await pool.query(

        `UPDATE food_listings

         SET status = 'completed'

         WHERE food_id = ?`,

        [pickup.food_id]

      );

      res.json({

        message:
          "Pickup completed successfully"

      });

    } catch (e) {

      console.error(
        "Complete pickup error:",
        e
      );

      res.status(500).json({
        error: e.message
      });

    }

  }
);


// =====================================================
// ADMIN ACCESS MIDDLEWARE
// =====================================================

function requireAdmin(req, res, next) {

  if (req.user.role !== "admin") {

    return res.status(403).json({
      error: "Admin access required"
    });

  }

  next();

}


// =====================================================
// ADMIN PICKUP MANAGEMENT
// =====================================================

// GET ALL PICKUP REQUESTS - ADMIN

app.get(
  "/api/admin/pickups",
  authenticateToken,
  requireAdmin,
  async (req, res) => {

    try {

      const [rows] = await pool.query(

        `SELECT
          pr.request_id,
          pr.food_id,
          pr.volunteer_id,
          pr.request_status,
          pr.requested_at,
          pr.completed_at,

          fl.food_name,
          fl.quantity,
          fl.unit,
          fl.pickup_location,
          fl.expiry_datetime,

          fc.category_name,

          donor.name AS donor_name,

          volunteer.name AS volunteer_name,
          volunteer.email AS volunteer_email,
          volunteer.phone AS volunteer_phone

        FROM pickup_requests pr

        INNER JOIN food_listings fl
          ON pr.food_id = fl.food_id

        INNER JOIN food_categories fc
          ON fl.category_id = fc.category_id

        INNER JOIN users donor
          ON fl.donor_id = donor.user_id

        INNER JOIN users volunteer
          ON pr.volunteer_id = volunteer.user_id

        ORDER BY
          pr.requested_at DESC`

      );

      res.json(rows);

    } catch (e) {

      console.error(
        "Admin pickup fetch error:",
        e
      );

      res.status(500).json({
        error: e.message
      });

    }

  }
);


// =====================================================
// APPROVE PICKUP REQUEST - ADMIN
// =====================================================

app.put(
  "/api/admin/pickups/:id/approve",
  authenticateToken,
  requireAdmin,
  async (req, res) => {

    try {

      const requestId =
        Number(req.params.id);

      if (!requestId) {

        return res.status(400).json({
          error: "Invalid pickup request ID"
        });

      }

      const [rows] = await pool.query(

        `SELECT
          request_id,
          food_id,
          request_status

        FROM pickup_requests

        WHERE request_id = ?`,

        [requestId]

      );

      if (rows.length === 0) {

        return res.status(404).json({
          error: "Pickup request not found"
        });

      }

      const pickup = rows[0];

      if (pickup.request_status !== "pending") {

        return res.status(400).json({
          error:
            "Only pending pickup requests can be approved"
        });

      }

      await pool.query(

        `UPDATE pickup_requests

         SET request_status = 'approved'

         WHERE request_id = ?`,

        [requestId]

      );

      res.json({

        message:
          "Pickup request approved successfully"

      });

    } catch (e) {

      console.error(
        "Approve pickup error:",
        e
      );

      res.status(500).json({
        error: e.message
      });

    }

  }
);


// =====================================================
// REJECT PICKUP REQUEST - ADMIN
// =====================================================

app.put(
  "/api/admin/pickups/:id/reject",
  authenticateToken,
  requireAdmin,
  async (req, res) => {

    try {

      const requestId =
        Number(req.params.id);

      if (!requestId) {

        return res.status(400).json({
          error: "Invalid pickup request ID"
        });

      }

      const [rows] = await pool.query(

        `SELECT
          request_id,
          food_id,
          request_status

        FROM pickup_requests

        WHERE request_id = ?`,

        [requestId]

      );

      if (rows.length === 0) {

        return res.status(404).json({
          error: "Pickup request not found"
        });

      }

      const pickup = rows[0];

      if (
        pickup.request_status !== "pending" &&
        pickup.request_status !== "approved"
      ) {

        return res.status(400).json({
          error:
            "This pickup request cannot be rejected"
        });

      }

      await pool.query(

        `UPDATE pickup_requests

         SET request_status = 'rejected'

         WHERE request_id = ?`,

        [requestId]

      );

      // Make the food available again

      await pool.query(

        `UPDATE food_listings

         SET status = 'available'

         WHERE food_id = ?`,

        [pickup.food_id]

      );

      res.json({

        message:
          "Pickup request rejected successfully"

      });

    } catch (e) {

      console.error(
        "Reject pickup error:",
        e
      );

      res.status(500).json({
        error: e.message
      });

    }

  }
);


// =====================================================
// ADMIN USER MANAGEMENT
// =====================================================

// GET ALL USERS - ADMIN

app.get(
  "/api/admin/users",
  authenticateToken,
  requireAdmin,
  async (req, res) => {

    try {

      const [rows] = await pool.query(

        `SELECT
          user_id,
          name,
          email,
          role,
          phone,
          created_at

        FROM users

        ORDER BY
          created_at DESC`

      );

      res.json(rows);

    } catch (e) {

      console.error(
        "Admin users fetch error:",
        e
      );

      res.status(500).json({
        error: e.message
      });

    }

  }
);


// =====================================================
// FOOD CATEGORIES
// =====================================================

app.get("/api/categories", async (req, res) => {

  try {

    const [rows] =
      await pool.query(

        `SELECT *
         FROM food_categories
         ORDER BY category_name`

      );

    res.json(rows);

  } catch (e) {

    res.status(500).json({
      error: e.message
    });

  }

});


// =====================================================
// FRONTEND
// =====================================================

app.get("*", (req, res) => {

  res.sendFile(
    path.join(
      __dirname,
      "../frontend/index.html"
    )
  );

});


// =====================================================
// START SERVER
// =====================================================

app.listen(
  3000,
  () => {

    console.log(
      "FoodRescue running at http://localhost:3000"
    );

  }
);