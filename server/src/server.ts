import app from "./app";
import { port, aiServiceUrl } from "./config";

const PORT = port();
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Proxying AI requests to ${aiServiceUrl()}`);
});
