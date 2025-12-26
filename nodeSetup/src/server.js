const http = require("http");
  const routes = require("./routes");
  
  const PORT = process.env.PORT || 3000;
  
  const server = http.createServer((req, res) => {
    routes.handleRequest(req, res);
  });
  
  server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
  });
  