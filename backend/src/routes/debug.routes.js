const express = require('express');
const { throwSampleError } = require('../controllers/debug.controller');

const router = express.Router();

router.get('/error', throwSampleError);

module.exports = router;
