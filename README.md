# AI Note Suggestion Plugin for Obsidian

**AI Note Suggestion** plugin for Obsidian is designed to make your note-taking experience even more seamless. It harnesses the power of AI vector search using [Weaviate](https://weaviate.io/) to suggest similar and related notes as you type, reducing your dependency on traditional tagging systems. You can also filter notes by tags, giving you the flexibility you need.

## Features:
- **AI-Powered Suggestions:** The plugin suggests similar notes based on the content you're currently typing.
- **Related Notes:** Discover related notes that you might have missed, enhancing your note-taking context.
- **Tag Filtering:** If you still prefer using tags, you can filter notes by tags as well.
- **Quick search:** Also you can quickly search anytime with command palette

![](images/1.png)
![](images/2.png)
![](images/3.png)
![](images/4.png)

## Setting Up AI Note Suggestion

To use the AI Note Suggestion plugin, you'll need to set up [Weaviate](https://weaviate.io/), an AI vector search engine. We recommend using [Docker Compose](https://docs.docker.com/compose/) for an easier setup. You can also use weaviate cloud service if you don't want to use your local machine as a server. Here are the steps to get started:

**Step 1: Install Docker**
If you don't have [Docker](https://docs.docker.com/) installed on your machine, you'll need to do so. Docker provides a platform for running [Weaviate](https://weaviate.io/) 

**Step 2: Download Weaviate Using Docker Compose**
You can check out [weaviate's install guides](https://weaviate.io/developers/weaviate/installation) for in depth information or if you are new to this follow instruction bellow,

1. Create a `docker-compose.yml` file with the following content:

```yaml
  weaviate-obsidian:
    container_name: weaviate-obsidian
    depends_on:
      - t2v-transformers-obsidian
    command:
    - --host
    - 0.0.0.0
    - --port
    - '8080'
    - --scheme
    - http
    image: semitechnologies/weaviate
    ports:
    - 3636:8080
    volumes:
      - ./data/weaviate-data:/var/lib/weaviate
    restart: unless-stopped
    environment:
      TRANSFORMERS_INFERENCE_API: 'http://t2v-transformers-obsidian:8080'
      QUERY_DEFAULTS_LIMIT: 25
      AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED: 'true'
      PERSISTENCE_DATA_PATH: '/var/lib/weaviate'
      DEFAULT_VECTORIZER_MODULE: 'text2vec-transformers'
      ENABLE_MODULES: 'text2vec-transformers'
      CLUSTER_HOSTNAME: 'node1'


  t2v-transformers-obsidian:
    container_name: t2v-transformers-obsidian
    image: semitechnologies/transformers-inference:sentence-transformers-multi-qa-MiniLM-L6-cos-v1
    restart: unless-stopped
    environment:
      ENABLE_CUDA: '0'
```
here is the full compose file [compose.yml](https://github.com/echo-saurav/obsidian-ai-note-suggestion/blob/main/docker/compose.yml)

2. In the directory where you saved the `docker-compose.yml` file, run the following command
```bash
docker-compose up -d
```
This command pulls the Weaviate image from Docker Hub and runs it as a container on your local machine.    

**Step 3: Configure AI Note Suggestion**

1. Once you have Weaviate up and running, go to the settings of the **AI Note Suggestion** plugin in Obsidian.
2. In the plugin settings, provide the **Weaviate Address** where your Weaviate instance is running (usually `http://localhost:3636` if you followed the default settings)


Now, you're all set to enjoy the enhanced note-taking experience provided by the AI Note Suggestion plugin!

## Code blocks for query
This is a simple code blocks for querying similar notes based on given texts

  
~~~markdown
```match
text: one
showPercentage: true
limit: 10
distanceLimit: .98
autoCut: 2
```
~~~



## Todo's
- [x] Side pane list
- [x] add yaml for code query for tags 
- [x] Code query inside files like 
- [x] remove code blocks when update files on weaviate
- [x] extract tags and update file with tags
- [x] Similar notes inside note
- [x] add autocut settings and yaml code
- [x] add distance threshold on settings and yaml code
- [ ] Split notes by regex and upload splits note in vector for long notes
- [ ] add a search command to search by similar text
- [ ] show status on every events (update,sync etc)



