/**
* Backend app.js
*
**/

const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql");
const gps_distance = require("gps-distance");
const settings = require("./settings");
const cors = require("cors");
const app = express();

const Status = Object.freeze({
	WAITING: 1, //Waiting for ride to be created.
	PENDING: 2, //Pending taxi to arrive
	INPROGRESS: 3, //Ride in progress
	COMPLETED: 4, //Ride completed
	DELETED: 0, //Ride deleted
});

const VAN_TAXI_BASE = 3.20;
const VAN_TAXI_PER_K = 1.84;
const EMISSION_G_PER_K = 118;

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));
// parse application/json
app.use(bodyParser.json());
app.use(cors());

app.listen(settings.PORT, () => {
	console.log("Server running on port " + settings.PORT);
});

const conn = mysql.createConnection(settings.CONN_INFO);

/**
 * Initial signon request
 * Requires:
 * 	username(string)
 *
 * Returns:
 * 	username(string)
 * 	user_id(int)
 */
app.post("/api/signin", (req, res, next) => {
	var param = req.body;

	console.log(JSON.stringify(param, null, 3));

	if (!("username" in param)) {
		res.json({
			status: "ERROR",
			message: "Insufficient parameters provided.",
			payload: {},
		});
		return;
	}

	const q = `SELECT * FROM users WHERE username = '${param.username}';`;

	console.log("Querying users table...");

	conn.query(q, (err, result) => {
		if (err) {
			res.json({
				status: "ERROR",
				message: "Database error",
				payload: {},
			});
			return;
		}

		//Check if user already exists by username
		if (result.length == 0) {
			const q = `INSERT INTO users (username, rating) VALUES ('${param.username}', 8);`;

			console.log("Creating new user...");
			conn.query(q, (err) => {
				if (err) {
					res.json({
						status: "ERROR",
						message: "Database error",
						payload: {},
					});
					return;
				}

				//Get new inserted user id.
				const q = "SELECT LAST_INSERT_ID();";

				conn.query(q, (err, result) => {
					if (err) {
						res.json({
							status: "ERROR",
							message: "Database error",
							payload: {},
						});
						return;
					}

					res.json({
						status: "OK",
						message: "All good",
						payload: {
							username: param.username,
							userID: result[0]["LAST_INSERT_ID()"]
						},
					});

				});
			});

		} else {
			res.json({
				status: "OK",
				message: "All good",
				payload: {
					username: result[0].username,
					userID: result[0].id,
				},
			});

		}
	});

	return;
});

/**
 * Retrive existing requests nearby
 * Requires:
 * 	radius(int)
 * 	loc.lon(float)
 * 	loc.lat(float)
 * Returns:
 * 	Array {
 * 	 id (int)
 *   user_id (int)
 *   username (string)
 * 	 status (int)
 *   startLocLon (float)
 * 	 startLocLat (float)
 *   endLocLon (float)
 *   endLocLat (float)
 *   expire_at (datetime)
 *  }
 */
app.post("/api/getRequests", (req, res, next) => {
	var param = req.body;

	console.log(JSON.stringify(param, null, 3));

	if (!("radius" in param)|| !("loc" in param)) {
		res.json({
			status: "ERROR",
			message: "Insufficient parameters provided.",
			payload: {},
		});
		return;
	}

	const loc = param.loc;
	if (!("lon" in loc)|| !("lat" in loc)) {
		res.json({
			status: "ERROR",
			message: "Insufficient parameters provided!",
			payload: {},
		});
		return;
	}

	const r_earth = 6.378e6; //Earth radius
	const dy = param.radius;
	const dx = param.radius;

	const lat_0 = loc.lat - (dy / r_earth) * (180 / Math.PI);
	const lat_1 = loc.lat + (dy / r_earth) * (180 / Math.PI);
	const lon_0 = loc.lon - (dx / r_earth) * (180 / Math.PI) / Math.cos(loc.lat * Math.PI/180);
	const lon_1 = loc.lon + (dx / r_earth) * (180 / Math.PI) / Math.cos(loc.lat * Math.PI/180);

	const conn = mysql.createConnection(settings.CONN_INFO);

	conn.connect((err) => {
		if (err) {
			console.log(err);
			res.json({
				status: "ERROR",
				message: "Database error",
				payload: {},
			});
			return;
		}

		const getRequest = `SELECT * FROM requests WHERE
		startLocLon >= ${lon_0} AND startLocLon <= ${lon_1}
		AND startLocLat >= ${lat_0} AND startLocLat <= ${lat_1}`;

		conn.query(getRequest, (err, result) => {
			if (err) {
				console.log(err);
				res.json({
					status: "ERROR",
					message: "Database error",
					payload: {},
				});
				return;
			}

			res.json({
				status: "OK",
				message: "All good",
				payload: {
					result,
				},
			});
		});
	});
});

/**
 * Submits a request to join or create a new ride
 * Requires:
 *  user_id(int)
 *  username (string)
 * 	startLoc.lon(float)
 *  startLoc.lat(float)
 * 	endLoc.lon(float)
 *  endLoc.lat(float)
 * 	expires(int) (min)
 */
app.post("/api/requestRide", (req, res, next) => {
	const param = req.body;

	if (!("startLoc" in param) || !("endLoc" in param) ||
		!("expires" in param) || !("user_id" in param) || !("username" in param)) {
			console.log("username" in param, "user_id" in param, "expires" in param)
		res.json({
			status: "ERROR",
			message: "Insufficient parameters provided.",
			payload: {},
		});
		return;
	}

	const startLoc = param.startLoc;
	const endLoc = param.startLoc;
	if (!("lon" in startLoc) || !("lat" in startLoc) ||
		!("lon" in endLoc) || !("lat" in endLoc)) {
			console.log('a')
		res.json({
			status: "ERROR",
			message: "Insufficient parameters provided!",
			payload: {},
		});
		return;
	}

	const conn = mysql.createConnection(settings.CONN_INFO);

	conn.connect((err) => {
		if (err) {
			console.log(err);
			res.json({
				status: "ERROR",
				message: "Database error",
				payload: {},
			});
			return;
		}

		const requestRide = `INSERT INTO requests 
		(user_id, username, created_at, startLocLon, startLocLat, endLocLon, endLocLat, expire_at, status) VALUES
		(${param.user_id}, "${param.username}", ${conn.escape(new Date())}, ${startLoc.lon}, ${startLoc.lat}, ${endLoc.lon}, ${endLoc.lat},
		 ${conn.escape(new Date(Date.now() + param.expires * 60e3))}, ${Status.WAITING})`;

		conn.query(requestRide, (err) => {
			if (err) {
				console.log(err);
				res.json({
					status: "ERROR",
					message: "Database error",
					payload: {},
				});
				return;
			}

			const requestIDQuery = "SELECT LAST_INSERT_ID();";

			conn.query(requestIDQuery, (err, result) => {
				if (err) {
					console.log(err);
					res.json({
						status: "ERROR",
						message: "Database error",
						payload: {},
					});
					return;
				}

				const requestID = result[0]["LAST_INSERT_ID()"];

				const currentRequestIDQuery = `UPDATE users
				SET currentRequestID = "${requestID}"
				WHERE id = ${param.user_id}`;

				conn.query(currentRequestIDQuery, (err) => {
					if (err) {
						console.log(err);
						res.json({
							status: "ERROR",
							message: "Database error",
							payload: {},
						});
						return;
					}
					res.json({
						status: "OK",
						message: "All good",
						payload: {
							requestID,
						}
					});
				});
			});
		});
	});
});

/**
 * Gets info on the current ride
 * Requires:
 *  username (string)
 * 
 * Returns:
 * 	ride
 */
app.post("/api/getRideInfo", (req, res) => {
	const param = req.body;

	if (!("username" in param)) {
		res.json({
			status: "ERROR",
			message: "Insufficient parameters provided.",
			payload: {},
		});
		return;
	}

	const username = param.username;

	const conn = mysql.createConnection(settings.CONN_INFO);
	conn.connect((err) => {
		if (err) {
			console.log(err);
			res.json({
				status: "ERROR",
				message: "Database error",
				payload: {},
			});
			return;
		}

		const rideIDQuery = `SELECT currentRideID FROM users WHERE username="${username}"`;
		let currentRideID;
		let ride;

		conn.query(rideIDQuery, (err, result) => {
			if (err) {
				console.log(err);
				res.json({
					status: "ERROR",
					message: "Database error",
					payload: {},
				});
				return;
			}

			currentRideID = (typeof result[0] === "undefined") ? null : result[0].currentRideID;

			if (currentRideID === null) {
				res.json({
					status: "OK",
					message: "All good",
					payload: {
						ride: {},
					},
				});
				return;
			}

			const rideQuery = `SELECT * FROM rides WHERE id = ${currentRideID}`;

			conn.query(rideQuery, (err, result) => {
				if (err) {
					console.log(err);
					res.json({
						status: "ERROR",
						message: "Database error",
						payload: {},
					});
					return;
				}

				ride = result;

				res.json({
					status: "OK",
					message: "All good",
					payload: {
						ride: ride[0],
					}
				});
			});
		});
	});
});

/**
 * Gets cost and co2 emission savings from the current ride
 * Requires:
 *  username (string)
 * 
 * Returns:
 * 	costSavings (float) ($)
 * 	emissionsSavings (float) (g CO2)
 */
app.post("/api/getSavings", (req, res) => {
	const param = req.body;

	if (!("username" in param)) {
		res.json({
			status: "ERROR",
			message: "Insufficient parameters provided.",
			payload: {},
		});
		return;
	}

	const username = param.username;
	const conn = mysql.createConnection(settings.CONN_INFO);

	conn.connect((err) => {
		if (err) {
			res.json({
				status: "ERROR",
				message: "Database error",
				payload: {},
			});
			return;
		}

		const currentQuery = `SELECT currentRideID, currentRequestID FROM users
		WHERE username = "${username}"`;

		conn.query(currentQuery, (err, result) => {
			if (err) {
				res.json({
					status: "ERROR",
					message: "Database error",
					payload: {},
				});
				return;
			}

			if (result.length == 0) {
				res.json({
					status: "ERROR",
					message: "User does not exist",
					payload: {},
				});
				return;
			}

			const { currentRideID, currentRequestID } = result[0];

			const requestQuery = `SELECT
			startLocLon, startLocLat, endLocLon, endLocLat
			FROM requests WHERE id = ${currentRequestID}`;
			const rideQuery = `SELECT
			startLocLon, startLocLat, endLocLon, endLocLat, user_1, user_2, user_3, user_4
			FROM rides WHERE id = ${currentRideID}`;

			conn.query(requestQuery, (err, result) => {
				if (err || result.length == 0) {
					res.json({
						status: "ERROR",
						message: "Database error",
						payload: {},
					});
					return;
				}

				const request = result[0];

				conn.query(rideQuery, (err, result) => {
					if (err || result.length == 0) {
						res.json({
							status: "ERROR",
							message: "Database error",
							payload: {},
						});
						return;
					}
	
					const ride = result[0];
					const users = [ride.user_1, ride.user_2, ride.user_3, ride.user_4];
					const numUsers = users.map(user => 
						(user === null || user === 0) ? 0 : 1
					).reduce((total, next) => total + next);
					
					const requestDistance = gps_distance(request.startLocLat, request.startLocLon,request.endLocLat, request.endLocLon);
					const rideDistance = gps_distance(ride.startLocLat, ride.startLocLon,		ride.endLocLat, ride.endLocLon);

					const requestCost = VAN_TAXI_BASE + VAN_TAXI_PER_K * requestDistance;
					const rideCost = (VAN_TAXI_BASE + VAN_TAXI_PER_K * rideDistance) /
					numUsers * ((numUsers == 1) ? 1 : (requestDistance / rideDistance));
					const costSavings = requestCost - rideCost;

					const requestEmissions = EMISSION_G_PER_K * requestDistance;
					const rideEmissions = (EMISSION_G_PER_K * rideDistance) / numUsers;
					const emissionSavings = (requestEmissions - rideEmissions);

					res.json({
						status: "OK",
						message: "All good",
						payload: {
							costSavings: Math.abs(costSavings),
							emissionSavings: Math.abs(emissionSavings),
						}
					});
				});
			});
		});
	});
});
