import express from 'express';
import ollama from 'ollama';

const app = express();


app.use(express.json());

app.post('/ask-query', async (req, res) => {
  const { query } = req.body;

  try {
    const response = await ollama.chat({
      model: 'llama3',
      messages: [{ role: 'user', content: query }],
    });

    res.json({ reply: response.message.content });
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: 'Error interacting with the model' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});