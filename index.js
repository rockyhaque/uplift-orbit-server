const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// config
require("dotenv").config();
const port = process.env.PORT || 5000;

// middleware
const corsOptions = {
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
    optionSuccessStatus: 200
}
app.use(cors(corsOptions));
app.use(express.json());


//----------------------------- database connection---------------------------

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@revive.2tkcldw.mongodb.net/?appName=Revive`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)

    const database = client.db('upliftOrbitDB');
    const jobCollection = database.collection('jobs');
    const bidCollection = database.collection('bids');

    // get all jobs data 
    app.get('/jobs', async (req, res) => {
      const result = await jobCollection.find().toArray();
      res.send(result);
    })

    // get a single job data 
    app.get('/job/:id', async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await jobCollection.findOne(query);
      res.send(result);
    })

    // save a bid data 
    app.post('/bid', async (req, res) => {
      const bidData = req.body;
      const result = await bidCollection.insertOne(bidData)
      res.send(result)
    })

    // save a job data 
    app.post('/job', async (req, res) => {
      const jobData = req.body;
      const result = await jobCollection.insertOne(jobData)
      res.send(result)
    })

    // get all jobs posted by a specific user
    app.get('/jobs/:email', async (req, res) => {
      const email = req.params.email;
      const query = {'buyer.email': email};
      const result = await jobCollection.find(query).toArray();
      res.send(result);
    })

    // delete a job data
    app.delete('/job/:id', async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await jobCollection.deleteOne(query);
      res.send(result);
    })

    // update a job data
    app.put('/job/:id', async(req, res) => {
      const id = req.params.id;
      const updatedJobData = req.body;
      const query = {_id: new ObjectId(id)};
      const options = {upsert: true};
      const updateDoc = {
        $set: {
          ...updatedJobData
        }
      }
      const result = await jobCollection.updateOne(query, updateDoc, options);
      res.send(result);
    })









    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
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
