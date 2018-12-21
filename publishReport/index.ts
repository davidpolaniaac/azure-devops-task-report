import tl = require('azure-pipelines-task-lib/task');
import * as common from './common';
import * as nodeApi from 'azure-devops-node-api';
import * as GitApi from 'azure-devops-node-api/GitApi';
import * as GitInterfaces from 'azure-devops-node-api/interfaces/GitInterfaces';

const Inliner = require('inliner');
const REPOSITORY_NAME: string = "DevOps_Vault_Reports_Extension";
const RELEASE_DEFINITIONID = tl.getVariable("RELEASE_DEFINITIONID");
const RELEASE_DEFINITIONENVIRONMENTID = tl.getVariable("RELEASE_DEFINITIONENVIRONMENTID");
const RELEASE_RELEASEID = tl.getVariable("RELEASE_RELEASEID");
const RELEASE_ATTEMPTNUMBER = tl.getVariable("RELEASE_ATTEMPTNUMBER");

async function createReport(path: string): Promise<any> {
    return new Promise(function (resolve, reject) {
        new Inliner(path, function (error: any, html: any) {
            resolve(html);
            if (error) {
                reject(new Error('the report could not be converted'))
            }
        });
      });
}

async function getRepository ( repos: GitInterfaces.GitRepository[], nameRepository: string) {
    for (let index = 0; index < repos.length; index++) {
        let element: GitInterfaces.GitRepository  = repos[index];
        if(element.name == nameRepository){
            common.heading(" ¡ Repository ready !");
            return element;
        }
    }
}

async function saveReport (content: string, nameRepository : string, inputReportName : string) {

    common.banner('Git Configuration');
    let webApi: nodeApi.WebApi = await common.getWebApi();
    let gitApiObject: GitApi.IGitApi = await webApi.getGitApi();
    let project: string = common.getProject();
    common.heading('Project');
    common.heading(project);

    try{

        common.banner("Create a repository");
        const createOptions: GitInterfaces.GitRepositoryCreateOptions = <GitInterfaces.GitRepositoryCreateOptions>{name: nameRepository};
        let newRepo: GitInterfaces.GitRepository = await gitApiObject.createRepository(createOptions, project);
        common.heading(newRepo.name as string);
    }
    catch (err) {

        common.heading(err.message);
    }

    common.banner("Get Repositories");
    const repos: GitInterfaces.GitRepository[] = await gitApiObject.getRepositories(project);
    console.log("There are", repos.length, "repositories in this project");

    common.banner("Get Repository");
    const repository: GitInterfaces.GitRepository = await getRepository(repos, nameRepository) as GitInterfaces.GitRepository;

    if (typeof repository === "undefined") {
        tl.setResult(tl.TaskResult.Failed, "Repository is undefined");
    }

    const repositoryId: string = repository.id as string;
    console.log("There is", repository.name, "repository in this project");
    const commitCriteria: GitInterfaces.GitQueryCommitsCriteria = <GitInterfaces.GitQueryCommitsCriteria> {$skip: 0, $top: 1};
    const commits: GitInterfaces.GitCommitRef[] =  await gitApiObject.getCommits(repositoryId, commitCriteria, project);
    let lastestCommit:string = "0000000000000000000000000000000000000000";

    if (typeof commits === undefined || commits.length == 0) {
        common.heading("commit init");
    }else{
        lastestCommit =  commits[0].commitId as string;
    }

    console.log("Top commit in this repository: ", lastestCommit);

    common.banner("Save a report");

    try{
        
        let push : GitInterfaces.GitPush = <GitInterfaces.GitPush>{
            commits: [
            {
                comment: inputReportName,
                changes: [
                    {
                        changeType: GitInterfaces.VersionControlChangeType.Add,
                        item: {
                            path: `/${RELEASE_DEFINITIONID}/${RELEASE_RELEASEID}/${RELEASE_DEFINITIONENVIRONMENTID}/${RELEASE_ATTEMPTNUMBER}/${Date.now()}.html`,
                        },
                        newContent: {
                            content: content,
                            contentType: GitInterfaces.ItemContentType.RawText
                        }
                    }
                ]
            }
        ],refUpdates:[
            {
                name: "refs/heads/master",
                oldObjectId: lastestCommit
            }
        ],repository};
    
        let newPush: GitInterfaces.GitPush = await gitApiObject.createPush(push,repositoryId,project);
        common.heading("¡ report has been saved successfully !");
    }
    catch (err) {

        console.log(err.message);
        tl.setResult(tl.TaskResult.Failed, err.message);
    }

}

async function run() {

    try {
        const inputPathReport: string = tl.getInput('pathReport', true);
        const inputReportName: string = tl.getInput('ReportName', true);
        const html = await createReport(inputPathReport);
        await saveReport(html,REPOSITORY_NAME,inputReportName);
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
}

run();