USE foodrescue;

-- 1. Show available food with donor names
SELECT * FROM available_food;

-- 2. Total food listed by each donor
SELECT u.name, SUM(f.quantity) AS total_servings
FROM users u JOIN food_listings f ON u.user_id=f.donor_id
GROUP BY u.user_id, u.name
ORDER BY total_servings DESC;

-- 3. Pending pickup requests
SELECT pr.request_id, f.food_name, v.name AS volunteer, pr.request_status
FROM pickup_requests pr
JOIN food_listings f ON pr.food_id=f.food_id
JOIN users v ON pr.volunteer_id=v.user_id
WHERE pr.request_status='pending';

-- 4. Food category statistics
SELECT c.category_name, COUNT(f.food_id) AS listings, COALESCE(SUM(f.quantity),0) AS servings
FROM food_categories c
LEFT JOIN food_listings f ON c.category_id=f.category_id
GROUP BY c.category_id, c.category_name;

-- 5. Distribution summary
SELECT beneficiary_group, SUM(servings_distributed) AS servings
FROM distributions
GROUP BY beneficiary_group
ORDER BY servings DESC;
