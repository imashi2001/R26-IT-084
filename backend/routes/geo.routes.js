const { Router } = require("express");

const { searchPlaces, reversePlace } = require("../controllers/geo.controller");

const router = Router();

router.get("/search", searchPlaces);
router.get("/reverse", reversePlace);

module.exports = router;
