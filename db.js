// db.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool(); // 會自動從 process.env 讀取

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool, // 可選
};
