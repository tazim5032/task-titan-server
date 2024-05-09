const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const port = process.env.PORT || 5000;

const app = express();

const corsOptions = {
    origin: [
        'http://localhost:5173',
        'http://localhost:5174',

    ],
    credentials: true,
    optionSuccessStatus: 200,
}
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());


//verify jwt middleware
const verifyToken = (req, res, next) => {
    const token = req.cookies?.token;

    if(!token) return res.status(401).send({message: 'unauthorized access'});

    if (token) {
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
            if (err) {
                res.status(401).send({message: 'unauthorized access'});
            }
            console.log(decoded);
            
            req.user = decoded;
            next();
        })
    }

   
}

//${process.env.DB_USER}
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.o4eqbyc.mongodb.net/?retryWrites=true&w=majority`
//const uri = "mongodb+srv://taskTitans:f84vN7rOZEp4Me9I@cluster0.o4eqbyc.mongodb.net/?retryWrites=true&w=majority";

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
        const jobsCollection = client.db('taskTitans').collection('jobs');
        const bidsCollection = client.db('taskTitans').collection('bids');

        //jwt generate - json web token
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            //token banaiteci
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '365d'
            })
            //browser er cookie te send korteci
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',

            }).send({ success: true })
            // res.send({ token })
        })

        //clear token on logout
        app.get('/logout', (req, res) => {
            res.clearCookie('token', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                maxAge: 0,
            }).send({ success: true })
        })

        //get all jobs from db
        app.get('/jobs', async (req, res) => {
            const result = await jobsCollection.find().toArray();
            res.send(result);
        })

        // Get a single job data from db using job id
        app.get('/job/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await jobsCollection.findOne(query);
            res.send(result);
        })

        // Save a bid data in db
        app.post('/bid', async (req, res) => {
            const bidData = req.body;
            const result = await bidsCollection.insertOne(bidData);
            res.send(result);
        })

        // Save a job data in db
        app.post('/job', async (req, res) => {
            const jobData = req.body;
            const result = await jobsCollection.insertOne(jobData);
            res.send(result);
        })

        // get all jobs posted by a specific user
        app.get('/jobs/:email', verifyToken, async (req, res) => {
            const tokenEmail = req.user.email;
            const email = req.params.email;

            if(tokenEmail !== email){
                return res.status(403).send({message: 'forbidden access'});
            }

            const query = { 'buyer.email': email }
            const result = await jobsCollection.find(query).toArray();
            res.send(result);
        })

        

        // delete a job data from db
        app.delete('/job/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await jobsCollection.deleteOne(query)
            res.send(result)
        })

        // update a job in db
        app.put('/job/:id', verifyToken, async (req, res) => {
            const id = req.params.id
            const jobData = req.body
            const query = { _id: new ObjectId(id) }
            const options = { upsert: true }
            const updateDoc = {
                $set: {
                    ...jobData,
                },
            }
            const result = await jobsCollection.updateOne(query, updateDoc, options)
            res.send(result)
        })

        // get all bids for a specific user
        app.get('/my-bids/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { 'email': email }
            const result = await bidsCollection.find(query).toArray();
            res.send(result);
        })


        // get all bid requests from db for job owner
        app.get('/bid-requests/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { 'buyer.email': email }
            const result = await bidsCollection.find(query).toArray();
            res.send(result);
        })

        //update bid status
        //jdi pura data update kortam tahole put use kortam, only status ta update korteci tai patch use korteci
        app.patch('/bid/:id', async (req, res) => {
            const id = req.params.id;
            const status = req.body;
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: status,
            }

            const result = await bidsCollection.updateOne(query, updateDoc)
            res.send(result)
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {

    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello from task-titans Server....')
})

app.listen(port, () => console.log(`Server running on port ${port}`))
