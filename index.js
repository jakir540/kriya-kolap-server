const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require("mongodb");

// middleware
const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wkiarbk.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const classCollection = client.db("yogaDB").collection("classes");
    const instructorsCollection = client.db("yogaDB").collection("instructors");

    //----------------classes api--------------

    app.get("/classes", async (req, res) => {
      const cursor =  classCollection.find().sort({students: -1}).limit(6);
      const result =await cursor.toArray();
      res.send(result);
    });

    
//instructors api
app.get("/instructors", async (req, res) => {
  const cursor =  instructorsCollection.find().sort({enrollment: -1}).limit(6);
  const result =await cursor.toArray();
  res.send(result);
});


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("kriya kolap server is running");
});

app.listen(port, () => {
  console.log(`kriya kolap is running on port ${port}`);
});
