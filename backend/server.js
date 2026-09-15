require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

app.get("/api/stats", async (req,res) => {
  try {
    const [[{donations}]] = await pool.query("SELECT COUNT(*) donations FROM food_listings");
    const [[{servings}]] = await pool.query("SELECT COALESCE(SUM(quantity),0) servings FROM food_listings");
    const [[{pickups}]] = await pool.query("SELECT COUNT(*) pickups FROM pickup_requests WHERE request_status='completed'");
    const [[{volunteers}]] = await pool.query("SELECT COUNT(*) volunteers FROM users WHERE role='volunteer'");
    res.json({donations, servings, pickups, volunteers});
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.get("/api/food", async (req,res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM available_food ORDER BY expiry_datetime ASC");
    res.json(rows);
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.post("/api/food", async (req,res) => {
  try {
    const {donor_id=2, category_id, food_name, quantity, unit, description, pickup_location, expiry_datetime} = req.body;
    await pool.query(
      `INSERT INTO food_listings
      (donor_id,category_id,food_name,quantity,unit,description,pickup_location,expiry_datetime)
      VALUES (?,?,?,?,?,?,?,?)`,
      [donor_id,category_id,food_name,quantity,unit,description,pickup_location,expiry_datetime]
    );
    res.json({message:"Food listing created successfully"});
  } catch(e) { res.status(400).json({error:e.message}); }
});

app.post("/api/pickups", async (req,res) => {
  try {
    const {food_id, volunteer_id=4} = req.body;
    await pool.query("INSERT INTO pickup_requests(food_id,volunteer_id) VALUES (?,?)",[food_id,volunteer_id]);
    await pool.query("UPDATE food_listings SET status='requested' WHERE food_id=?",[food_id]);
    res.json({message:"Pickup request submitted"});
  } catch(e) { res.status(400).json({error:e.message}); }
});

app.get("/api/categories", async (req,res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM food_categories ORDER BY category_name");
    res.json(rows);
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.get("*", (req,res) => res.sendFile(path.join(__dirname,"../frontend/index.html")));

app.listen(3000, () => console.log("FoodRescue running at http://localhost:3000"));
