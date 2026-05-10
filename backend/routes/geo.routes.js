const { Router } = require("express");

const { searchPlaces } = require("../controllers/geo.controller");

const router = Router();

router.get("/search", searchPlaces);

module.exports = router;
