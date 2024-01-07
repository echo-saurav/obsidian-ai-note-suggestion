// import { pipeline , env} from  "@xenova/transformers"
// // import fs from "fs"
// // import path from "path"

// export const getEmbedding=async ()=>{

// 	env.localModelPath = '/Users/sauravahmed/Documents/vector-plugin-obsidian/.obsidian/plugins/obsidian-ai-note-suggestion/vectors'
// 	// env.localModelPath="./all-MiniLM-L6-v2/"
// 	env.allowRemoteModels = false;
// 	env.allowLocalModels = true;

// 	try{
// 	const pipe = await pipeline('feature-extraction', 'all-MiniLM-L6-v2', 
// 	{progress_callback:(p:any)=>{console.log(p)}}
// 	);
// 	const res = await pipe("This is nice", { pooling: 'mean', normalize: true });

// 	console.log(res);
// 	}catch(e){
// 		console.log(e)
// 	}

// 	// // Specify the directory and file names
// 	// // Get and print the current directory
// 	// const currentDirectory = process.cwd();
// 	// console.log('Current directory:', currentDirectory);

// 	// // const directoryName = './myDirectory';
// 	// const directoryName = '/Users/sauravahmed/Documents/vector-plugin-obsidian/.obsidian/plugins/obsidian-ai-note-suggestion/vectors'

// 	// const fileName = 'myFile.txt';	
// 	// // Create a directory
// 	// fs.mkdir(directoryName, (err) => {
// 	//   if (err) {
// 	// 	console.error('Error creating directory:', err);
// 	//   } else {
// 	// 	console.log(`Directory "${directoryName}" created successfully.`);
// 	// 	
// 	// 	// Create a file inside the directory
// 	// 	const filePath = path.join(directoryName, fileName);
// 	// 	const time = new Date().getTime()
// 	// 	fs.writeFile(filePath, 'Hello, this is my file content! '+time, (err) => {
// 	// 	  if (err) {
// 	// 		console.error('Error creating file:', err);
// 	// 	  } else {
// 	// 		console.log(`File "${fileName}" created successfully in "${directoryName}".`);
// 	// 	  }
// 	// 	});
// 	//   }
// 	// });
// }
