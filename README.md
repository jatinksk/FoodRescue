# FoodRescue 🍲

FoodRescue is a DBMS-based web application that connects surplus food donors with volunteers so usable food can be rescued and distributed to people in need.

## Technology
- Frontend: HTML, CSS, JavaScript
- Backend: Node.js + Express
- Database: MySQL
- Version control: Git + GitHub

## Main Features
- Food donor listings
- Available surplus food dashboard
- Volunteer pickup requests
- Distribution records
- Feedback
- Admin statistics
- MySQL views, stored procedure, trigger and indexes

## Setup

1. Install Node.js and MySQL.
2. Open the project folder in VS Code.
3. In MySQL Workbench, run `database/schema.sql`.
4. Then run `database/sample_data.sql`.
5. Open `backend/server.js` and replace `YOUR_MYSQL_PASSWORD` with your local MySQL root password.
6. Open the VS Code terminal and run:

```bash
npm install
npm start
```

7. Open `http://localhost:3000`.

## Demo Accounts
- Admin: admin@foodrescue.local / admin123
- Donor: canteen@foodrescue.local / donor123
- Volunteer: rahul@foodrescue.local / volunteer123

> These are demo credentials for a local academic project only.

## DBMS Concepts Demonstrated
Primary/foreign keys, constraints, normalization, joins, aggregate queries, views, stored procedures, triggers, indexes and relational design.
