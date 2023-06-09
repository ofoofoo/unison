/*
|--------------------------------------------------------------------------
| api.js -- server routes
|--------------------------------------------------------------------------
|
| This file defines the routes for your server.
|
*/

const express = require("express");

// import models so we can interact with the database
const User = require("./models/user");
const Lobby = require("./models/lobby");

// import authentication library
const auth = require("./auth");

// api endpoints: all these paths will be prefixed with "/api/"
const router = express.Router();

//initialize socket
const socketManager = require("./server-socket");

router.post("/login", auth.login);
router.post("/logout", auth.logout);
router.get("/whoami", (req, res) => {
  if (!req.user) {
    // not logged in
    return res.send({});
  }

  res.send(req.user);
});

router.post("/initsocket", (req, res) => {
  // do nothing if user not logged in
  // console.log(req.user);
  if (req.user)
    socketManager.addUser(req.user, socketManager.getSocketFromSocketID(req.body.socketid));
  res.send({});
});

// |------------------------------|
// | write your API methods below!|
// |------------------------------|

router.get("/getuser", (req, res) => {
  if (req.user) {
    User.findOne({ _id: req.query.userId }).then((user) => {
      res.send(user);
    });
  }
});

router.get("/scores", (req, res) => {
  User.find()
    .sort({ wins: -1, username: 1 })
    .then((messages) => res.send(messages));
});

router.post("/username", (req, res) => {
  User.updateOne({ _id: req.body.userId }, { $set: { username: req.body.username } }).then(() => {
    console.log("");
  });
});

router.post("/userlobby", (req, res) => {
  User.updateOne({ _id: req.body.userId }, { $set: { lobby: req.body.lobby } }).then(() => {
    console.log("");
  });
});

router.post("/lobby", (req, res) => {
  // console.log("hullo", req.body.lobbyName);
  // Lobby.find({ lobbyName: req.body.lobbyName }).then((lobby) => {
  //   console.log(lobby);
  // });

  Lobby.findOne({
    $and: [{ lobbyName: req.body.lobbyName }, { isPlaying: false }],
  })
    .then((lobby) => {
      if (lobby) {
        Lobby.updateOne(
          {
            $and: [{ lobbyName: req.body.lobbyName }, { isPlaying: false }],
          },
          { $push: { userIds: req.body.userId } }
          // $push: { userIds: req.body.userId }
        )
          .then(() => {
            // console.log("hahhaha");
            socketManager.getIo().emit("lobbySocket", [req.body.userId, req.body.lobbyName]);
          })
          .then(() => console.log(""));
      } else {
        const newLobby = new Lobby({
          lobbyName: req.body.lobbyName,
          userIds: [req.body.userId],
          isPlaying: false,
        });
        return newLobby.save().then(() => {
          // console.log("hahahahahha");
          socketManager.getIo().emit("lobbySocket", [req.body.userId, req.body.lobbyName]);
        });

        // socket initiaition here maybe?
      }
    })
    .then(() => {
      console.log("");
    });
});

router.get("/lobby", (req, res) => {
  Lobby.findOne({ lobbyName: req.query.lobbyName })
    .then((lobby) => {
      if (!lobby) {
        res.send({ lobbyName: "" });
      } else {
        res.send(lobby);
      }
    })
    .then(() => console.log(""));
});

router.post("/leavelobby", (req, res) => {
  User.updateOne({ _id: req.body.userId }, { $set: { lobby: "" } }).then();

  Lobby.updateOne(
    { lobbyName: req.body.lobbyName },
    {
      $pullAll: {
        userIds: [req.body.userId],
      },
    }
  )
    .then(() => {
      Lobby.findOne({ lobbyName: req.body.lobbyName }).then((lobby) => {
        if (lobby) {
          if (lobby.userIds.length === 0) {
            Lobby.deleteOne({ lobbyName: req.body.lobbyName }).then();
          } else {
            socketManager.getIo().emit("lobbyLeave", req.body.userId);
          }
        }
      });
    })
    .then(() => console.log(""));
});

router.post("/setLobbyPlaying", (req, res) => {
  Lobby.updateOne({ lobbyName: req.body.lobbyName }, { $set: { isPlaying: true } }).then(() =>
    console.log("")
  );
});

router.post("/setLobbyNotPlaying", (req, res) => {
  Lobby.updateOne({ lobbyName: req.body.lobbyName }, { $set: { isPlaying: false } }).then(() =>
    console.log("")
  );
});
router.post("/incrementGamesPlayed", (req, res) => {
  User.updateOne({ _id: req.body.userId }, { $inc: { gamesPlayed: 1 } }).then(() =>
    console.log("")
  );
});

router.post("/incrementWins", (req, res) => {
  User.updateOne({ _id: req.body.userId }, { $inc: { wins: 1 } }).then(() => console.log(""));
});

router.post("/gameStart", (req, res) => {
  socketManager.getIo().emit("gameStart", req.body.lobbyName);
  socketManager.getIo().emit("setGameState", req.body.lobbyList);
});

// anything else falls to this "not found" case
router.all("*", (req, res) => {
  console.log(`API route not found: ${req.method} ${req.url}`);
  res.status(404).send({ msg: "API route not found" });
});

module.exports = router;
