const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// config
require("dotenv").config();
const port = process.env.PORT || 5000;

// middleware
const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:5174", "https://uplift-orbit.web.app"],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// verify jwt middleware
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: "Unauthorized Access!" });
  }
  if (token) {
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
      if (error) {
        return res.status(401).send({ message: "Unauthorized Access!" });
      }
      req.user = decoded;
      next();
    });
  }
};

//----------------------------- database connection---------------------------

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@revive.2tkcldw.mongodb.net/?appName=Revive`;

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

    const database = client.db("upliftOrbitDB");
    const jobCollection = database.collection("jobs");
    const bidCollection = database.collection("bids");

    // JWT generate
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "7d",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // clear token with logout
    app.get("/logout", (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          maxAge: 0,
        })
        .send({ success: true });
    });

    // get all jobs data
    app.get("/jobs", async (req, res) => {
      const result = await jobCollection.find().toArray();
      res.send(result);
    });

    // get a single job data
    app.get("/job/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobCollection.findOne(query);
      res.send(result);
    });

    // save a bid data
    app.post("/bid", async (req, res) => {
      const bidData = req.body;

      // check duplicate request
      const query = {
        email: bidData.email,
        jobId: bidData.jobId,
      };
      const alreadyApplied = await bidCollection.findOne(query);

      if (alreadyApplied) {
        return res
          .status(400)
          .send("You have already made a proposal for this job!");
      }

      const result = await bidCollection.insertOne(bidData);

      // update bid count in jobs collection
      const updateDoc = {
        $inc: {bid_count: 1}
      }
      const jobQuery = {_id: new ObjectId(bidData.jobId)}
      const updateBidCount = await jobCollection.updateOne(jobQuery, updateDoc);

      res.send(result);
    });

    // save a job data
    app.post("/job", async (req, res) => {
      const jobData = req.body;
      const result = await jobCollection.insertOne(jobData);
      res.send(result);
    });

    // get all jobs posted by a specific user
    app.get("/jobs/:email", verifyToken, async (req, res) => {
      const tokenEmail = req.user.email;
      const email = req.params.email;
      if (tokenEmail !== email) {
        return res.status(403).send({ message: "Forbidden Access!" });
      }
      const query = { "buyer.email": email };
      const result = await jobCollection.find(query).toArray();
      res.send(result);
    });

    // delete a job data
    app.delete("/job/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobCollection.deleteOne(query);
      res.send(result);
    });

    // update a job data
    app.put("/job/:id", async (req, res) => {
      const id = req.params.id;
      const updatedJobData = req.body;
      const query = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ...updatedJobData,
        },
      };
      const result = await jobCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

    // get all bids specific user
    app.get("/mybids/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const result = await bidCollection.find(query).toArray();
      res.send(result);
    });

    // get all bid request for specific job owner or buyer
    app.get("/bidRequests/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { "buyer.email": email };
      const result = await bidCollection.find(query).toArray();
      res.send(result);
    });

    // update bid status
    app.patch("/bid/:id", async (req, res) => {
      const id = req.params.id;
      const status = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: status,
      };
      const result = await bidCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // get all jobs data from bd to pagination
    app.get("/allJobs", async (req, res) => {
      const size = parseInt(req.query.size);
      const page = parseInt(req.query.page) - 1;
      const filter = req.query.filter;
      const sort = req.query.sort;
      const search = req.query.search;

      let query = {
        title: {$regex: search, $options: 'i'}
      };

      if(filter){
        // query = { ...query, category: filter}
        query.category = filter;
      }

      let options = {};
      if(sort){
        options = {sort: {deadline: sort === 'asc' ? 1 : -1}}
      }
      
      const result = await jobCollection
        .find(query, options)
        .skip(page * size)
        .limit(size)
        .toArray()
      res.send(result);
    });


    // get all jobs data count from db
    app.get("/jobsCount", async (req, res) => {
      const filter = req.query.filter;
      const search = req.query.search;

      let query = {
        title: {$regex: search, $options: 'i'}
      };

      if(filter){
        // query = { ...query, category: filter}
        query.category = filter;
      }
      
      const count = await jobCollection.countDocuments(query);
      res.send({ count });
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
  res.send("Uplift Orbit Server is running...");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
