const express = require("express");

// Middleware to parse incoming JSON requests

const app = express();
app.use(express.json());
const cors = require("cors");
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;
const {
  MongoClient,
  ServerApiVersion,
  ObjectId,
  Transaction,
} = require("mongodb");

//payment gatway system start
const SSLCommerzPayment = require("sslcommerz-lts");

const tran_id = new ObjectId().toString();

//payment gatway system end

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

//payment gatway system start

const store_id = process.env.PAYMENT_STORE_ID;
const store_passwd = process.env.PAYMENT_METHOD_KEY;
const is_live = false;

//payment gatway system end

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
    // await client.connect();
    const classCollection = client.db("yogaDB").collection("classes");
    const instructorsCollection = client.db("yogaDB").collection("instructors");
    const blogCollection = client.db("yogaDB").collection("blogs");
    const instructorsCollectionFeedback = client
      .db("yogaDB")
      .collection("instructorsFeedback");
    const usersCollection = client.db("yogaDB").collection("users");
    const mySelectClassCollection = client
      .db("yogaDB")
      .collection("mySelectClass");
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
    app.get("/users", VerifyJwt, VerifyAdmin, async (req, res) => {
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
    app.get(
      "/users/instructor/:email",
      VerifyJwt,
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
      const email = req.query.email;
      console.log(email);
      const cursor = classCollection.find();
      const result = await cursor.toArray();

      try {
        const result = await classCollection.find({ email: email }).toArray();

        console.log("249 classes ", result);

        if (result.length === 0) {
          return res.send({
            message: "No classes found for the provided email",
          });
        }

        res.send(result);
      } catch (error) {
        console.error("Error fetching instructor classes:", error);
      }

      res.send(result);
    });

    // // get specific classes in instructor
    // app.get("/instructor/ownclasses", async (req, res) => {
    //   const email = req.query.email; // Get the email from query parameters
    //   console.log(email);

    //   if (!email) {
    //     return res
    //       .status(400)
    //       .send({ error: "Email query parameter is required" });
    //   }

    //   try {
    //     const result = await classCollection
    //       .find({ instructorEmail: email })
    //       .toArray(); // Filter classes by instructor email

    //     console.log("249 classes ", result);

    //     if (result.length === 0) {
    //       return res
    //         .status(404)
    //         .send({ message: "No classes found for the provided email" });
    //     }

    //     res.send(result);
    //   } catch (error) {
    //     console.error("Error fetching instructor classes:", error);
    //     res
    //       .status(500)
    //       .send({ error: "An error occurred while fetching classes" });
    //   }
    // });

    // Add class use this api
    app.post("/classes", VerifyJwt, VerifyInstructor, async (req, res) => {
      const newClass = req.body;
      const result = await classCollection.insertOne(newClass);
      res.send(result);
    });
    // update class use this api
    app.put("/classes/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateClass = req.body;
      console.log(updateClass);
      const result = await classCollection.updateOne(filter, {
        $set: updateClass,
      });
      res.send(result);
    });

    //my Select class api
    app.post("/mySelectClasses", async (req, res) => {
      const mySelectClass = req.body;
      console.log({ mySelectClass });
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

    // ******************************************************************

    //instructors api
    app.get("/instructors", async (req, res) => {
      const cursor = instructorsCollection.find();
      const result = await cursor.toArray();
      // console.log({result})
      res.send(result);
    });

    app.get("/receivedInstructorsFeedback", async (req, res) => {
      const result = await instructorsCollectionFeedback.find().toArray();

      res.send(result);
    });

    //send feedbak to instructor

    app.post("/feedbackInstructor", VerifyJwt, async (req, res) => {
      const feedback = req.body;
      const result = await instructorsCollectionFeedback.insertOne(feedback);
      res.send(result);
    });

    // ******************************************************************
    // blog api

    // create blog

    app.post("/blog", async (req, res) => {
      if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).send({ error: "Request body is empty" });
      }

      const newBlogs = req.body;
      const result = await blogCollection.insertOne(newBlogs);
      res.send(result);
    });

    // get all blogs
    app.get("/blogs", async (req, res) => {
      const result = await blogCollection.find().toArray();
      res.send(result);
    });

    //get single blog

    const { ObjectId } = require("mongodb");

    app.get("/blogs/:id", async (req, res) => {
      const id = req.params.id;

      // Ensure the id is a valid ObjectId
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ error: "Invalid ID format" });
      }

      // Create a new ObjectId instance using `new`
      const objectId = new ObjectId(id);

      // Query MongoDB using the ObjectId
      const result = await blogCollection.findOne({ _id: objectId });

      // Send the result back
      if (result) {
        res.send(result);
      } else {
        res.status(404).send({ error: "Blog not found" });
      }
    });

    // payment api
    // =============================================================================
    //payment

    app.post("/order", async (req, res) => {
      console.log(req.body);
      console.log(req.body.classId);

      const singleClass = await classCollection.findOne({
        _id: new ObjectId(req.body.classId),
      });
      console.log({ singleClass });

      const order = req.body;

      const data = {
        total_amount: singleClass?.price,
        currency: "BDT",
        tran_id: tran_id, // use unique tran_id for each api call
        success_url: `http://localhost:5173/payment/success`,
        // success_url: `https://kriya-kolap-sever-jakir540.vercel.app/payment/success/${tran_id}`,
        fail_url: `http://localhost:5173/payment/fail/${tran_id}`,
        // fail_url: `https://kriya-kolap-sever-jakir540.vercel.app/payment/fail/${tran_id}`,
        cancel_url: "http://localhost:3030/cancel",
        ipn_url: "http://localhost:3030/ipn",
        shipping_method: "Courier",
        product_name: singleClass?.classname,
        product_category: "Electronic",
        product_profile: "general",
        cus_name: "Customer Name",
        cus_email: singleClass?.email,
        cus_add1: "Dhaka",
        cus_add2: "Dhaka",
        cus_city: "Dhaka",
        cus_state: "Dhaka",
        cus_postcode: order?.PostCode,
        cus_country: "Bangladesh",
        cus_phone: "01711111111",
        cus_fax: "01711111111",
        ship_name: "Customer Name",
        ship_add1: "Dhaka",
        ship_add2: "Dhaka",
        ship_city: "Dhaka",
        ship_state: "Dhaka",
        ship_postcode: 1000,
        ship_country: "Bangladesh",
      };
      console.log(data);
      const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
      sslcz.init(data).then((apiResponse) => {
        // Redirect the user to payment gateway
        let GatewayPageURL = apiResponse.GatewayPageURL;
        res.send({ url: GatewayPageURL });

        const finalOrder = {
          singleClass,
          paidStatus: false,
          transactionId: tran_id,
        };
        const result = paymentsCollection.insertOne(finalOrder);

        console.log("Redirecting to: ", GatewayPageURL);
      });

      app.post("/payment/success/:tranID", async (req, res) => {
        console.log("from backedn bKASH" + req.params.tranID);

        const result = await paymentsCollection.updateOne(
          {
            transactionId: req.params.tranID,
          },
          {
            $set: {
              paidStatus: true,
            },
          }
        );

        if (result.modifiedCount > 0) {
          res.redirect(
            // `http://localhost:5173/payment/success/${req.params.tranID}`
            "/"
          );
        }
      });

      app.post("/payment/fail/:tranID", async (req, res) => {
        const result = await paymentsCollection.deleteOne({
          transactionId: req.params.tranID,
        });
        if (result.deletedCount) {
          res.redirect(
            `http://localhost:5173/payment/fail/${req.params.tranID}`
          );
        }
      });
    });

    //payment
    // ====================================================================================
    app.post("/create-payment-intent", VerifyJwt, async (req, res) => {
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

    //specific class get for payment
    app.get("/classes/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await classCollection.findOne(filter);
      res.send(result);
    });

    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentsCollection.insertOne(payment);
      console.log(payment.selectClass);
      const filter = { _id: payment.selectClass };
      const deleteClass = await mySelectClassCollection.deleteOne(filter);

      console.log(deleteClass);

      res.send({ insertResult, deleteClass });
    });

    app.get("/paymentHistory", async (req, res) => {
      const result = await paymentsCollection
        .find()
        .sort({ date: -1 })
        .toArray();
      res.send(result);
    });

    app.get("/payments", async (req, res) => {
      const result = await paymentsCollection.find().toArray();
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
