const express = require("express");

const { open } = require("sqlite");

const sqlite3 = require("sqlite3");

const path = require("path");

const bcrypt = require("bcrypt");

const jwt = require("jsonwebtoken");

const databasePath = path.join(__dirname, "twitterClone.db");

const app = express();

app.use(express.json());

let database = null;

const initializeDbAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,

      driver: sqlite3.Database,
    });

    app.listen(3000, () =>
      console.log("Server Running at http://localhost:3000/")
    );
  } catch (error) {
    console.log(`DB Error: ${error.message}`);

    process.exit(1);
  }
};

initializeDbAndServer();

function authenticateToken(request, response, next) {
  let jwtToken;

  const authHeader = request.headers["authorization"];

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }

  if (jwtToken === undefined) {
    response.status(401);

    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);

        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
}

const validatePassword = (password) => {
  return password.length > 5;
};

app.post("/register", async (request, response) => {
  const { username, name, password, gender, location } = request.body;

  const hashedPassword = await bcrypt.hash(password, 10);

  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;

  const databaseUser = await database.get(selectUserQuery);

  if (databaseUser === undefined) {
    const createUserQuery = `



     INSERT INTO



      user (username, name, password, gender)



     VALUES



      (



       '${username}',



       '${name}',



       '${hashedPassword}',



       '${gender}' 



      );`;

    if (validatePassword(password)) {
      await database.run(createUserQuery);

      response.send("User created successfully");
    } else {
      response.status(400);

      response.send("Password is too short");
    }
  } else {
    response.status(400);

    response.send("User already exists");
  }
});

app.post("/login", async (request, response) => {
  const { username, password } = request.body;

  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;

  const dbUser = await database.get(selectUserQuery);

  if (dbUser === undefined) {
    response.status(400);

    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);

    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };

      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");

      response.send({ jwtToken });
    } else {
      response.status(400);

      response.send("Invalid password");
    }
  }
});

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const getStatesQuery = `



    SELECT



      name AS username,tweet,date_time AS dateTime



    FROM



      user NATURAL JOIN tweet



    ORDER BY dateTime DESC  LIMIT 4 OFFSET 1;`;

  const statesArray = await database.all(getStatesQuery);

  response.send(statesArray);
});

app.get("/user/following/", authenticateToken, async (request, response) => {
  const { username, password } = request.body;

  const getStatesQuery = `



    SELECT



      DISTINCT(name)



    FROM



      user INNER JOIN follower ON user.user_id=follower.follower_user_id; WHERE username='${username}'`;

  const statesArray = await database.all(getStatesQuery);

  response.send(statesArray);
});

app.get("/user/followers/", authenticateToken, async (request, response) => {
  const { username, password } = request.body;

  const getStatesQuery = `



    SELECT



      DISTINCT(name)



    FROM



      user INNER JOIN follower ON user.user_id=follower.following_user_id; WHERE username='${username}'`;

  const statesArray = await database.all(getStatesQuery);

  response.send(statesArray);
});

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const getStatesQuery = `



    SELECT



      name AS username,tweet,date_time AS dateTime



    FROM



      user NATURAL JOIN tweet;`;

  const statesArray = await database.all(getStatesQuery);

  response.send(statesArray);
});

app.get("/tweets/:tweetId/", authenticateToken, (req, res) => {
  const requestedTweetId = req.params.tweetId;

  const query = `

        SELECT tweet, COUNT(like.like_id) AS likes, COUNT(reply.reply_id) AS replies, tweet.date_time, user.username

        FROM tweet 

        INNER JOIN like  ON tweet.tweet_id = like.tweet_id

        INNER JOIN reply  ON tweet.tweet_id = reply.tweet_id

        INNER JOIN user  ON tweet.user_id = user.user_id

        WHERE tweet.tweet_id = ${requestedTweetId};

    `;

  database.get(query, [requestedTweetId], (err, row) => {
    if (err) {
      return res.status(500).send("Internal Server Error");
    }

    if (!row) {
      return res.status(404).send("Tweet not found");
    }

    const tweetDetails = {
      tweet: row.tweet,

      likes: row.likes,

      replies: row.replies,

      dateTime: row.date_time,

      username: row.username,
    };

    res.send(tweetDetails);
  });
});

app.get(
  "/tweets/:tweetId/likes",

  authenticateToken,

  async (request, response) => {
    const { tweetId } = request.params;

    const getStatesQuery = `

    SELECT

      user.name 

    FROM

       tweet INNER JOIN like ON tweet.tweet_id=like.tweet_id

       INNER JOIN user ON user.user_id=like.user_id

    WHERE tweet.tweet_id=${tweetId};`;

    const statesArray = await database.all(getStatesQuery);

    const likes = statesArray.map((row) => row.name);

    response.send({ likes });
  }
);

app.get(
  "/tweets/:tweetId/replies",

  authenticateToken,

  async (request, response) => {
    const { tweetId } = request.params;

    const getStatesQuery = `

    SELECT

      user.name,reply.reply 

    FROM

       tweet INNER JOIN reply ON tweet.tweet_id=reply.tweet_id

       INNER JOIN user ON user.user_id=reply.user_id

    WHERE tweet.tweet_id=${tweetId};`;

    const statesArray = await database.all(getStatesQuery);

    const replies = statesArray.map((row) => {
      row.name, row.reply;
    });

    response.send({ replies });
  }
);

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { tweet } = request.body;

  const getStatesQuery = `



   INSERT INTO



      tweet (tweet)



     VALUES



      (



       '${tweet}'



      );`;

  const statesArray = await database.run(getStatesQuery);

  response.send("Created a Tweet");
});

app.delete(
  "/tweets/:tweetId/",

  authenticateToken,

  async (request, response) => {
    const { tweetId } = request.params;

    const getStatesQuery = `



    DELETE 



    FROM



      tweet



    WHERE tweet_id=${tweetId};`;

    const statesArray = await database.run(getStatesQuery);

    response.send("Tweet Removed");
  }
);

module.exports = app;
