const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// middleware
const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};
//middleware
app.use(cors(corsOptions));
app.use(express.json());

//middleware

const VerifyJwt = (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized-access" });
  }
  // bearer token [bearer token]
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log("error", err);
      return res
        .status(401)
        .send({ error: true, message: "unauthorized-access" });
    }
    req.decoded = decoded;
    next();
  });
};

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
    const instructorsCollectionFeedback = client.db("yogaDB").collection("instructorsFeedback");
    const usersCollection = client.db("yogaDB").collection("users");
    const mySelectClassCollection = client.db("yogaDB").collection("mySelectClass");
    const paymentsCollection = client.db("yogaDB").collection("payments");

    //jwt

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    const VerifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      next();
    };

    // verify instructor -------------
    const VerifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "instructor") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      next();
    };

    //------------Users api ------------

    app.post("/users", async (req, res) => {
      const user = req.body;
      console.log(user);
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      console.log(existingUser);
      if (existingUser) {
        return res.send(existingUser);
      }
      const result = await usersCollection.insertOne(user);
      console.log(result);
      res.send(result);
    });

    // get all user from mongodb
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // make admin----------------
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };

      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };

      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // check admin and verify admin

    app.get("/users/admin/:email", VerifyJwt, VerifyAdmin, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        return res.send({ admin: false });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    // make instructor----------------------------
    app.patch("/users/instructor/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };

      const updatedDoc = {
        $set: {
          role: "instructor",
        },
      };

      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // check instructor -------------------------------------
    app.get("/users/instructor/:email",VerifyJwt,
      VerifyInstructor,
      async (req, res) => {
        const email = req.params.email;
        if (req.decoded.email !== email) {
          return res.send({ instructor: false });
        }
        const query = { email: email };
        const user = await usersCollection.findOne(query);
        const result = { instructor: user?.role === "instructor" };
        res.send(result);
      }
    );

    // ----------------classes api--------------
    // for home page only six popular class
    app.get("/classes", async (req, res) => {
      const cursor = classCollection.find().sort({ seats: -1 }).limit(6);
      const result = await cursor.toArray();
      res.send(result);
    });

    // for home page all  approved class
    app.get("/approvedClasses", async (req, res) => {
      const query = { status: "approved" };
      const cursor = classCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // form admin page all classes
    app.get("/instructor/classes", async (req, res) => {
      const cursor = classCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post("/classes", async (req, res) => {
      const newClass = req.body;
      const result = await classCollection.insertOne(newClass);
      res.send(result);
    });

    //my Select class api
    app.post("/mySelectClasses", async (req, res) => {
      const mySelectClass = req.body;
      const result = await mySelectClassCollection.insertOne(mySelectClass);
      res.send(result);
    });
    //my Select class api
    app.get("/mySelectClasses", async (req, res) => {
      const result = await mySelectClassCollection.find().toArray();
      res.send(result);
    });

    //my Select  specific class delete api
    app.delete("/mySelectClasses/:id", async (req, res) => {
      const id = req.params.id;
      console.log("222", id);
      const filter = { _id: id };

      const result = await mySelectClassCollection.deleteOne(filter);
      res.send(result);
    });

    //update class status
    app.patch("/deniedClasses/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: "denied",
        },
      };
      const result = await classCollection.updateOne(filter, updatedDoc);
      console.log(result);
      res.send(result);
    });

    // update class status

    app.patch("/approvedClasses/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: "approved",
        },
      };
      const result = await classCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    //instructors api
    app.get("/instructors", async (req, res) => {
      const cursor = instructorsCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    //send feedbak to instructor

    app.post("/feedbackInstructor", async (req, res) => {
      const feedback = req.body;
      const result = await instructorsCollectionFeedback.insertOne(feedback);
      res.send(result);
    });

    // payment api
    app.post("/create-payment-intent", async (req, res) => {
      const price = req.body;
      const amount = parseInt(price.paymentPrice * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payments",async(req,res)=>{
      const payment = req.body;
      const result = await paymentsCollection.insertOne(payment);
      res.send(result)
    })





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
