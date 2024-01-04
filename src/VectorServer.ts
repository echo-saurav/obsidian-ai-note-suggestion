// import { generateUuid5 } from 'weaviate-ts-client';
import weaviate, { WeaviateClient, generateUuid5 } from 'weaviate-ts-client';
import MyPlugin, { WeaviateFile } from './main';
import { Notice, TFile, parseYaml } from 'obsidian';


export default class VectorServer {
    private client: WeaviateClient
    private plugin: MyPlugin
    private weaviateAddress: string
    private weaviateClass: string
    private limit: number


    constructor(weaviateAddress: string, weaviateClass: string, limit: number, plugin: MyPlugin) {
        this.weaviateAddress = weaviateAddress
        this.weaviateClass = weaviateClass
        this.limit = limit
        this.plugin = plugin

        this.client = weaviate.client(this.getWeaviateConf(weaviateAddress))

    }


    async getExtensionNoteList(file: TFile) {
        const content = await this.plugin.app.vault.cachedRead(file)
        const cleanContent = this.getCleanDoc(content)
        const metadataContent = this.extractYAMLWithoutDashes(content)
        // const tags = this.getAllTags(content)
        // const metadata = this.extractYAMLWithoutDashes(content)

        return this.queryText(`${metadataContent}\n${cleanContent}`,
            [],
            this.plugin.settings.limit,
            this.plugin.settings.distanceLimit,
            this.plugin.settings.autoCut)
    }

    async getSidePaneNoteList(file: TFile) {
        const content = await this.plugin.app.vault.cachedRead(file)
        const cleanContent = this.getCleanDoc(content)
        // const tags = this.getAllTags(content)
        // const metadata = this.extractYAMLWithoutDashes(content)

        return this.queryText(cleanContent,
            [],
            this.plugin.settings.limit,
            this.plugin.settings.distanceLimit,
            this.plugin.settings.autoCut)
    }

    async getCodeBlockNoteList(content: string, tags: string[], limit: number, distanceLimit: number, autoCut: number) {

        return this.queryText(content, tags, limit, distanceLimit, autoCut)
    }


    async queryText(text: string, tags: string[], limit: number, distanceLimit: number, autoCut: number) {
        console.log(`auto cut: ${autoCut}, dis: ${distanceLimit}`)
        let nearText: { concepts: string[], distance?: number } = { concepts: [text] };

        if (distanceLimit > 0) {
            nearText = { concepts: [text], distance: distanceLimit }
        }

        const result = await this.client.graphql
            .get()
            .withClassName(this.weaviateClass)
            .withNearText(nearText)

        if (tags && tags.length > 0) {
            result.withWhere({
                path: ["tags"],
                operator: "ContainsAny",
                valueTextArray: tags
            })
        }
        if (autoCut > 0) {
            result.withAutocut(autoCut)
        }

        result.withLimit(limit)
            .withFields('filename path _additional { distance }')
        // .do()
        // .catch(e => { })
        const response = await result
            .do()
            .catch(e => { })

        return response
    }


    convertToSimilarPercentage(cosine: number) {
        const percentage = ((50 * cosine) - 100) * -1;
        return percentage.toFixed(2) + "%";
    }
    async queryWithNoteId(filePath: string, limit: number, distanceLimit: number, autoCut: number) {
        const note_id = generateUuid5(filePath)

        let nearObject: { id: string, distance?: number } = { id: note_id };

        if (distanceLimit > 0) {
            nearObject = { id: note_id, distance: distanceLimit }
        }


        const result = this.client.graphql
            .get()
            .withClassName(this.weaviateClass)
            .withNearObject(nearObject)
            .withLimit(limit)

        if (autoCut > 0) {
            result.withAutocut(autoCut)
        }

        const response = result
            .withFields('filename path _additional { distance }')
            .do()
            .catch(e => { })

        return response

    }


    getWeaviateConf(weaviateAddress: string) {
        const scheme = weaviateAddress.startsWith("http://") ? 'http' : 'https'
        let host = ""

        if (weaviateAddress.startsWith('http://')) {
            host = weaviateAddress.slice(7); // Remove the first 7 characters (http://:)
        } else {
            host = weaviateAddress.slice(8); // Remove the first 8 characters (https://:)
        }
        console.log(`host ${host}, scheme ${scheme}`)
        return {
            host: host,
            scheme: scheme
        }
    }


    async initClass() {
        // get classes
        const classDefinition = await this.client
            .schema
            .getter()
            .do();

        // check if class exist
        let classExist = false
        classDefinition.classes?.forEach(classObj => {

            if (classObj.class == this.weaviateClass) {
                classExist = true
            }
        })

        if (!classExist) {

            const result = await this.client.schema
                .classCreator()
                .withClass(this.getDefaultClassDefinition())
                .do()
            console.log("create class", JSON.stringify(result, null, 2));
        }
        return classExist
    }

    getDefaultClassDefinition() {

        const classDefinition = {
            class: this.weaviateClass,
            properties: [
                {
                    "name": "content",
                    "datatype": ["text"],
                    "moduleConfig": {
                        "text2vec-transformers": {
                            "skip": false,
                            "vectorizePropertyName": false
                        }
                    }
                },
                {
                    "name": "metadata",
                    "datatype": ["text"],
                    "moduleConfig": {
                        "text2vec-transformers": {
                            "skip": false,
                            "vectorizePropertyName": false
                        }
                    }
                },
                {
                    "name": "type",
                    "datatype": ["text"],
                    "moduleConfig": {
                        "text2vec-transformers": {
                            "skip": false,
                            "vectorizePropertyName": false
                        }
                    }
                },
                {
                    "name": "tags",
                    "datatype": ["text[]"],
                    "moduleConfig": {
                        "text2vec-transformers": {
                            "skip": false,
                            "vectorizePropertyName": false
                        }
                    }
                },

                {
                    "name": "path",
                    "datatype": ["text"],
                    "moduleConfig": {
                        "text2vec-transformers": {
                            "skip": true,
                            "vectorizePropertyName": false
                        }
                    }
                },
                {
                    "name": "filename",
                    "datatype": ["text"],
                    "moduleConfig": {
                        "text2vec-transformers": {
                            "skip": false,
                            "vectorizePropertyName": false
                        }
                    }
                },
                {
                    "name": "mtime",
                    "datatype": ["date"],
                    "moduleConfig": {
                        "text2vec-transformers": {
                            "skip": false,
                            "vectorizePropertyName": false
                        }
                    }
                },

            ],
            "vectorizer": "text2vec-transformers"
        };

        return classDefinition
    }

    async addNew(content: string, path: string, filename: string, mtime: number) {

        const cleanContent = this.getCleanDoc(content)

        const dataObj = {
            filename: filename,
            content: cleanContent,
            path: path,
            mtime: this.unixTimestampToRFC3339(mtime)
        }

        const note_id = generateUuid5(path)

        console.log("add new note: " + filename + " time:" + this.unixTimestampToRFC3339(mtime))
        return this.client.data
            .creator()
            .withClassName(this.weaviateClass)
            .withProperties(dataObj)
            .withId(note_id)
            .do()
            .catch(e => { })
    }

    // update notes if needed , add new if not exist in weaviate database
    async onUpdateFile(content: string, path: string, filename: string, mtime: number) {
        const res = await this.doesExist(path)
        const doesExist = res[0]
        const id = res[1]
        const oldMtime = res[2]
        const isUpdated = (mtime - this.rfc3339ToUnixTimestamp(oldMtime)) > 0

        const cleanContent = this.getCleanDoc(content)
        const tags = this.getAllTags(content)
        const metadata = this.extractYAMLWithoutDashes(content)

        // const yamlContent = this.objectToArray(this.extractYAMLWithoutDashes(content))

        if (doesExist && isUpdated) {
            console.log("updating " + path)
            const newValue = {
                content: cleanContent,
                metadata: metadata,
                tags: tags,
                mtime: this.unixTimestampToRFC3339(mtime)
            }

            console.log("newValue", newValue)

            await this.client.data
                .merger()  // merges properties into the object
                .withId(id).withClassName(this.weaviateClass)
                .withProperties(newValue)
                .do();

            console.log("update note: " + filename + " time:" + this.unixTimestampToRFC3339(mtime))
        } else if (!doesExist && isUpdated) {
            console.log("adding " + path)
            this.addNew(content, path, filename, mtime)
        }
    }


    async onRename(path: string, filename: string, mtime: number, oldPath: string) {
        this.doesExist(oldPath).then(response => {

            this.client.data
                .merger()  // merges properties into the object
                .withId(response[1]).withClassName(this.weaviateClass)
                .withProperties({
                    path: path,
                    filename: filename,
                    mtime: this.unixTimestampToRFC3339(mtime)
                })
                .do();
        })


    }

    async countOnDatabase() {

        const response = await this.client.graphql
            .aggregate()
            .withClassName(this.weaviateClass)
            .withFields('meta { count }')
            .do();
        console.log("count", response)
        const count = response.data["Aggregate"][this.weaviateClass][0]["meta"]["count"]
        return count
    }

    async onDeleteFile(path: string) {

        return this.client.data
            .deleter()
            .withClassName(this.weaviateClass)
            .withId(generateUuid5(path))
            .do()
    }

    async deleteAll() {
        const result = await this.client.schema.classDeleter()
            .withClassName(this.weaviateClass)
            .do();

        new Notice("Delete successful,Rescaning files and adding to database")

        this.initClass().then(() => {
            this.initialSyncFiles()
        })
    }

    async initialSyncFiles() {

        const files = this.plugin.app.vault.getMarkdownFiles()
        let i = 0
        await files.map(async (f, index) => {
            await this.plugin.app.vault.cachedRead(f).then(content => {
                this.addNew(content, f.path, f.basename, f.stat.mtime)
                i=i+1
            });

        })
        new Notice("Done rebuilding database")
        new Notice(`Total file added ${i}`)
    }

    async readAllPaths() {
        const classProperties = ["path"];

        const query = await this.client.graphql.get()
            .withClassName(this.weaviateClass)
            .withFields(classProperties.join(' ') + ' _additional { id }')
            .withLimit(this.limit).do();

        const files: WeaviateFile[] = query['data']['Get'][this.plugin.settings.weaviateClass]
        return files

    }



    async doesExist(path: string) {
        const result = await this.client.graphql
            .get()
            .withClassName(this.weaviateClass)
            .withWhere({
                path: ['path'],
                operator: 'Equal',
                valueText: path,
            })
            .withFields(["filename", "mtime"].join(' ') + ' _additional { id }')
            .do()

        const resultLength = result.data["Get"][this.weaviateClass].length

        if (resultLength > 0) {
            const id = result.data["Get"][this.weaviateClass][0]["_additional"]["id"]
            const mtime = result.data["Get"][this.weaviateClass][0]["mtime"]

            return [true, id, mtime]
        } else {
            return [false, 0, 0]
        }
    }

    unixTimestampToRFC3339(unixTimestamp: number): string {
        const date = new Date(unixTimestamp);
        const isoString = date.toISOString();
        return isoString;
    }

    rfc3339ToUnixTimestamp(rfc3339: string): number {
        const date = new Date(rfc3339);
        return date.getTime();
    }

    // remove all markdown syntax
    getCleanDoc(markdownContent: string) {
        // Define a regular expression to match YAML front matter
        const yamlFrontMatterRegex = /^---\s*\n[\s\S]*?\n---\s*\n/;

        // Define a regular expression to match code blocks
        const codeBlockRegex = /```[^`]*```/g;

        // Remove YAML front matter
        const markdownWithoutYAML = markdownContent.replace(yamlFrontMatterRegex, '');

        // Remove code blocks
        const markdownWithoutCodeBlocks = markdownWithoutYAML.replace(codeBlockRegex, '');

        return markdownWithoutCodeBlocks
    }

    extractYAMLWithoutDashes(markdownContent: string) {
        // Define a regular expression to match YAML front matter without the dashes
        const yamlFrontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;

        // Use the regular expression to extract YAML content
        const match = markdownContent.match(yamlFrontMatterRegex);

        // If a match is found, return the YAML content without dashes

        if (match && match[1]) {
            const yaml_string = match[1].trim();
            return yaml_string
            // return parseYaml(yaml_string)
        } else {
            return "";
        }
    }

    getAllTags(inputString: string) {
        const yaml = parseYaml(this.extractYAMLWithoutDashes(inputString))
        const yamlTags: Array<string> = yaml && yaml["tags"] ? yaml["tags"] : [];

        const regex = /#(\w+)/g;

        const tags = inputString.match(regex);
        const cleanTags = tags ? tags.map(match => match.slice(1)) : []

        if (tags || yamlTags) {
            return yamlTags.concat(cleanTags)
        } else {
            return []
        }
    }
}