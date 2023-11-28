//This code is the backend server code and will listen on port 3000

//import some require apis or libraries
import { OpenAI } from "openai";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";

//using airtable to store our text and embedding data
import Airtable from "airtable";

import pdf from "pdf-parse"
import fs from "fs"

//using below models to get embedding for our text, then completion
const MODEL_EMBEDDING = "text-embedding-ada-002";
const MODEL_COMPLETIONS = "text-davinci-003";

//previous provided pdf file
let previousPdfFileName=" ";
let totalRecordAirtable=0;

//now port is setup so that server can listen to 5173
//bodyparser to get some input and cors for communication between frontend and backend
const app = express();
const port = 5173;
app.use(bodyParser.json());
app.use(cors());


//below is our configuration for airtable
const airtableBase = new Airtable({
  apiKey: ADD_AIRTABLE_KEY_HERE,
}).base(ADD_AIRTABLE_BASE_KEY_HERE);
const myAirtable = airtableBase("EmbeddingData");
const myAirtableView = myAirtable.select({ view: "Grid view" });

//now we generate a openai configuration by passing our generated openai key 
const openai = new OpenAI({apiKey: ADD_OPENAPI_KEY_HERE});



function findCosineSimilarity(A, B) {
  let dotProduct = 0;
  let nA = 0;
  let nB = 0;
  for (let i = 0; i < A.length; i++) {
    dotProduct += A[i] * B[i];
    nA += A[i] * A[i];
    nB += B[i] * B[i];
  }
  nA = Math.sqrt(nA);
  nB = Math.sqrt(nB);
  return dotProduct / (nA * nB);
}


/* This function is to retrieve our data from airtable */
function getAirtableData() {
  return new Promise((resolve, reject) => {
    myAirtableView.firstPage((error, records) => {
      if (error) {
        console.log(error);
        return reject({});
      }
	  totalRecordAirtable = records.length;
      const recordsHash = {};
      records.forEach(
        (record) => (recordsHash[record.get("Text")] = record.get("Embeddings"))
      );
      resolve(recordsHash);
    });
  });
}


/* We find the cosine similarity between our stored embedding and embedding value of
   user question */
function findSimilarityScore(currentEmbeddingData, userMessageEmbedding) {
  const similarityScoreHash = {};
  Object.keys(currentEmbeddingData).forEach((text) => {
    similarityScoreHash[text] = findCosineSimilarity(
      userMessageEmbedding,
      JSON.parse(currentEmbeddingData[text])
    );
  });
  return similarityScoreHash;
}


/* this function will generate embedding for textData
   the generated embedding along with the text message will be stored
   to airtable*/
async function generateEmbeddingDataForText(textData) {
	const textDataEmbeddingResponse = await openai.embeddings.create({
      model: MODEL_EMBEDDING,
      input: textData,
      max_tokens: 64,
    });
	
	const textDataEmbedding = textDataEmbeddingResponse['data'][0]['embedding'];
	const textDataEmbeddingStr = textDataEmbedding.toString();

    //below will create record in airtable
	airtableBase('EmbeddingData').create({
        Text: textData,
        Embeddings: "["+textDataEmbeddingStr+"]",
    }).then(record => {
           console.log('Created record to airtable', record);
    }).catch(err => {
           console.error('Could not create record:', err);
    });
}



/*open a asynchronous post
  we make a opneai chat connected and get the results
*/
app.post('/chatapp', async (request, response) => {

    //get the pdf file name and the user question
	let pdfFileName = request.body.pdf_file_name;
	let userMessage = request.body.message_from_user;

    console.log("Message from user: "+userMessage);
	console.log("Information file: "+pdfFileName);
	console.log("Previous Information file: "+previousPdfFileName);

    // we open the pdf file and read the text content
    if(!(previousPdfFileName == pdfFileName)) {
		let pdfDataBuffer;
		try {
			pdfDataBuffer = fs.readFileSync(pdfFileName);
			pdf(pdfDataBuffer).then(function(data) {
			   //For the text generate embedding
		       generateEmbeddingDataForText(data.text);
	        });
			previousPdfFileName = pdfFileName;
		} catch(error) {
			console.log("no such file exist");
		}
	}


    // the entire embedding data and text we have stored in airtable will be read here
    const currentEmbeddingData = await getAirtableData();

	// we also generate embedding for the question asked by user
    const userMessageEmbeddingsResponse = await openai.embeddings.create({
      model: MODEL_EMBEDDING,
      input: userMessage,
      max_tokens: 64,
    });
    const userMessageEmbedding = userMessageEmbeddingsResponse['data'][0]['embedding'];

    /* we need to find the similarity between the user question and our
	   stored data*/
    const similarityScoreHash = findSimilarityScore(
      currentEmbeddingData,
      userMessageEmbedding
    );
	
    /* get the string with highest cosine similarity */
	let mostSimilarString = "";
    mostSimilarString = Object.keys(similarityScoreHash).reduce(
           (a, b) => (similarityScoreHash[a] > similarityScoreHash[b] ? a : b)
     );
	
	
	/* build final prompt to pass to our chat model */
    const finalPrompt = `
      Info: ${mostSimilarString}
      Question: ${userMessage}
      Answer:
    `;
	
	// final message with learning data and user question that is sent to model
	console.log("Final prompt message: "+finalPrompt);

	const output_msg = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
           {
              role: "system",
              content: finalPrompt,
           },
        ],
    });  

	console.log(output_msg);
	const completionOutput = output_msg.choices[0].message
	
	response.json({
        output: output_msg.choices[0].message,
    });
});


//listen on port 5173
app.listen(port, '172.24.215.104', () => {
  console.log(`waiting for input on port ${port}`);
});




