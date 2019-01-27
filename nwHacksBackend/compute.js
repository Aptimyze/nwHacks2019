/**
 * Computations to run every five minutes
 */

var frequency = 15; //in seconds

const mysql = require("mysql");
const settings = require("./settings");

const conn = mysql.createConnection(settings.CONN_INFO);

console.log("Running every "+frequency+" seconds...");

//Recurring task at frequency.
setInterval(function() {
	console.log("Running...");

}, frequency * 1000);