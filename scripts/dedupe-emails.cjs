require('dotenv').config();
const store = require('../store-db');

const state = store.getState();
console.log(`Database ready: ${state.emails.length} emails, ${state.groups.length} groups`);
