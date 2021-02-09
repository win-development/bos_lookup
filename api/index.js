// Import Dependencies
import {
  MongoClient
} from 'mongodb'
const nodeGeocoder = require('node-geocoder');
const queryString = require('querystring');

// Create cached connection variable
let cachedDb = null
// Set geocoding service
const options = {
  provider: 'google',
  apiKey: process.env.GOOGLE_API,
  formatter: null // 'gpx', 'string', ...
};
console.log(options.apiKey)

const geoCoder = nodeGeocoder(options);

// A function for connecting to MongoDB,
// taking a single parameter of the connection string
async function connectToDatabase(uri) {
  // If the database connection is cached,
  // use it instead of creating a new connection
  if (cachedDb) {
    return cachedDb
  }

  // If no connection is cached, create a new one
  const client = await MongoClient.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })

  // Select the database through the connection,
  // using the database path of the connection string

  const db_path = new URL(uri).pathname.substr(1)
  const db = client.db(db_path)

  // Cache the database connection and return the connection
  cachedDb = db
  return db
}

async function findCoordinates(streetAddress) {
  const response = await geoCoder.geocode(streetAddress)
  return response;
};

function capitalizeName(name) {
  return name.replace(/\w\S*/g, function (txt) {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

// The main, exported, function of the endpoint,
// dealing with the request and subsequent response
export default async (req, res) => {
  let rawData = "";
  req.on('data', function (chunk) {
    rawData += chunk;
  });
  req.on('end', async function () {
    const address = queryString.decode(rawData).address;
    const location = await findCoordinates(address);
    console.log({
      'location': location[0]
    })
    const db = await connectToDatabase(process.env.MONGODB_URI)
    const collection = await db.collection('bos_11');

    const bos_dist = await collection.findOne({
      geometry: {
        $geoIntersects: {
          $geometry: {
            type: "Point",
            coordinates: [location[0].longitude, location[0].latitude]
          }
        }
      }
    })
    let district_name = "None"
    if (bos_dist) {
      district_name = capitalizeName(bos_dist.properties.Name)
    }
    res.status(200).json({
      district: district_name
    })
  });
}