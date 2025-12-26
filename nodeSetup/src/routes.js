const exampleController = require("./controllers/exampleController");
  
  const handleRequest = (req, res) => {
    if (req.url === "/example" && req.method === "GET") {
      return exampleController.sayHello(req, res);
    }
    res.statusCode = 404;
    res.end("Not Found");
  };
  
  module.exports = { handleRequest };
  