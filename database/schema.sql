CREATE DATABASE IF NOT EXISTS foodrescue;
USE foodrescue;

CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin','donor','volunteer') NOT NULL,
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE food_categories (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    category_name VARCHAR(60) NOT NULL UNIQUE
);

CREATE TABLE food_listings (
    food_id INT AUTO_INCREMENT PRIMARY KEY,
    donor_id INT NOT NULL,
    category_id INT NOT NULL,
    food_name VARCHAR(120) NOT NULL,
    quantity INT NOT NULL,
    unit VARCHAR(30) DEFAULT 'servings',
    description VARCHAR(500),
    pickup_location VARCHAR(255) NOT NULL,
    expiry_datetime DATETIME NOT NULL,
    status ENUM('available','requested','collected','distributed','expired','cancelled') DEFAULT 'available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (donor_id) REFERENCES users(user_id),
    FOREIGN KEY (category_id) REFERENCES food_categories(category_id)
);

CREATE TABLE pickup_requests (
    request_id INT AUTO_INCREMENT PRIMARY KEY,
    food_id INT NOT NULL,
    volunteer_id INT NOT NULL,
    request_status ENUM('pending','approved','rejected','completed') DEFAULT 'pending',
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (food_id) REFERENCES food_listings(food_id),
    FOREIGN KEY (volunteer_id) REFERENCES users(user_id)
);

CREATE TABLE distributions (
    distribution_id INT AUTO_INCREMENT PRIMARY KEY,
    food_id INT NOT NULL,
    volunteer_id INT NOT NULL,
    beneficiary_group VARCHAR(150) NOT NULL,
    servings_distributed INT NOT NULL,
    distribution_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes VARCHAR(500),
    FOREIGN KEY (food_id) REFERENCES food_listings(food_id),
    FOREIGN KEY (volunteer_id) REFERENCES users(user_id)
);

CREATE TABLE feedback (
    feedback_id INT AUTO_INCREMENT PRIMARY KEY,
    food_id INT NOT NULL,
    user_id INT NOT NULL,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (food_id) REFERENCES food_listings(food_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE INDEX idx_food_status ON food_listings(status);
CREATE INDEX idx_food_expiry ON food_listings(expiry_datetime);

CREATE VIEW available_food AS
SELECT f.food_id, f.food_name, f.quantity, f.unit, c.category_name,
       f.pickup_location, f.expiry_datetime, u.name AS donor_name
FROM food_listings f
JOIN food_categories c ON f.category_id = c.category_id
JOIN users u ON f.donor_id = u.user_id
WHERE f.status = 'available';

DELIMITER //
CREATE TRIGGER before_food_insert
BEFORE INSERT ON food_listings
FOR EACH ROW
BEGIN
    IF NEW.quantity <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Quantity must be greater than zero';
    END IF;
END//

CREATE PROCEDURE get_donor_summary(IN p_donor_id INT)
BEGIN
    SELECT u.name AS donor_name,
           COUNT(f.food_id) AS total_listings,
           COALESCE(SUM(f.quantity),0) AS total_servings
    FROM users u
    LEFT JOIN food_listings f ON u.user_id = f.donor_id
    WHERE u.user_id = p_donor_id
    GROUP BY u.user_id, u.name;
END//
DELIMITER ;
