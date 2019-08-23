import * as tl from 'azure-pipelines-task-lib/task';
import * as common from 'azure-devops-task-utils';
import * as nodeApi from 'azure-devops-node-api';
import * as GitApi from 'azure-devops-node-api/GitApi';
import * as GitInterfaces from 'azure-devops-node-api/interfaces/GitInterfaces';

const Inliner = require('inliner');

async function createReport(path: string): Promise<any> {
    return new Promise(function (resolve, reject) {
        new Inliner(path, function (error: any, html: any) {
            if (error) {
                reject(new Error('the report could not be converted,  validate that the report exists !'))
            } else {
                resolve(html);
            }
        });
    });
}

async function createNewRepository(gitApiObject: GitApi.IGitApi, nameRepository: string, project: string): Promise<GitInterfaces.GitRepository> {

    let newRepo: GitInterfaces.GitRepository = <GitInterfaces.GitRepository>{};

    try {

        common.banner("Create a repository");
        const createOptions: GitInterfaces.GitRepositoryCreateOptions = <GitInterfaces.GitRepositoryCreateOptions>{ name: nameRepository };
        newRepo = await gitApiObject.createRepository(createOptions, project);
        common.heading(newRepo.name as string);
    }
    catch (err) {

        common.heading(err.message);
        tl.setResult(tl.TaskResult.Failed, err.message);
    }

    return newRepo;

}

async function getNewRepository(gitApiObject: GitApi.IGitApi, nameRepository: string, project: string): Promise<GitInterfaces.GitRepository> {

    let repository: GitInterfaces.GitRepository = <GitInterfaces.GitRepository>{};

    common.banner("Get Repository");

    repository = await gitApiObject.getRepository(nameRepository, project);

    if (repository) {

        common.heading(" ¡ Repository ready !");

    } else {

        repository = await createNewRepository(gitApiObject, nameRepository, project);
    }

    return repository;
}

async function getlastestCommit(nameRepository: string, gitApiObject: GitApi.IGitApi, project: string): Promise<string> {
    const COMMIT_INIT = "0000000000000000000000000000000000000000";
    common.banner("Get lastest Commit");
    const commitCriteria: GitInterfaces.GitQueryCommitsCriteria = <GitInterfaces.GitQueryCommitsCriteria>{ $skip: 0, $top: 1 };
    const commits: GitInterfaces.GitCommitRef[] = await gitApiObject.getCommits(nameRepository, commitCriteria, project);
    let lastestCommit: string = COMMIT_INIT;

    if (typeof commits === undefined || commits.length == 0) {
        common.heading("commit init");
    } else {
        lastestCommit = commits[0].commitId as string;
        console.log("Top commit in this repository: ", lastestCommit);
    }

    return lastestCommit;

}

function getPush(inputReportName: string, content: string, lastestCommit: string, repository: GitInterfaces.GitRepository, reportNameRandom: string): GitInterfaces.GitPush {

    const RELEASE_DEFINITIONID = tl.getVariable("RELEASE_DEFINITIONID");
    const RELEASE_DEFINITIONENVIRONMENTID = tl.getVariable("RELEASE_DEFINITIONENVIRONMENTID");
    const RELEASE_RELEASEID = tl.getVariable("RELEASE_RELEASEID");
    const RELEASE_ATTEMPTNUMBER = tl.getVariable("RELEASE_ATTEMPTNUMBER");

    const push: GitInterfaces.GitPush = <GitInterfaces.GitPush>{
        commits: [
            {
                comment: inputReportName,
                changes: [
                    {
                        changeType: GitInterfaces.VersionControlChangeType.Add,
                        item: {
                            path: `/${RELEASE_DEFINITIONID}/${RELEASE_RELEASEID}/${RELEASE_DEFINITIONENVIRONMENTID}/${RELEASE_ATTEMPTNUMBER}/${reportNameRandom}.html`,
                        },
                        newContent: {
                            content: content,
                            contentType: GitInterfaces.ItemContentType.RawText
                        }
                    }
                ]
            }
        ], refUpdates: [
            {
                name: "refs/heads/master",
                oldObjectId: lastestCommit
            }
        ], repository
    };

    return push;
}

async function saveReportInRelease(html: string, reportNameRandom: string) {

    try {

        common.banner("Save a report in release");
        const SYSTEM_DEFAULTWORKINGDIRECTORY = tl.getVariable("SYSTEM_DEFAULTWORKINGDIRECTORY");
        tl.writeFile(`${SYSTEM_DEFAULTWORKINGDIRECTORY}/${reportNameRandom}.html`, html, 'utf8');
        tl.addAttachment('publish-report', reportNameRandom, `${SYSTEM_DEFAULTWORKINGDIRECTORY}/${reportNameRandom}.html`);
        common.heading("¡ report has been saved successfully in release !");

    } catch (err) {

        tl.setResult(tl.TaskResult.Failed, err.message);
    }

}

async function saveReportInRepository(content: string, nameRepository: string, inputReportName: string, reportNameRandom: string) {

    common.banner('Git Configuration');

    const webApi: nodeApi.WebApi = await common.getWebApi();
    const gitApiObject: GitApi.IGitApi = await webApi.getGitApi();
    const project: string = common.getProject();

    common.heading('Project');
    common.heading(project);

    const repository: GitInterfaces.GitRepository = await getNewRepository(gitApiObject, nameRepository, project);
    const lastestCommit: string = await getlastestCommit(nameRepository, gitApiObject, project);

    try {

        common.banner("Save a report in repository");
        const push: GitInterfaces.GitPush = getPush(inputReportName, content, lastestCommit, repository, reportNameRandom);
        await gitApiObject.createPush(push, repository.id as string, project);
        common.heading("¡ report has been saved successfully in repository !");

    }
    catch (err) {

        tl.setResult(tl.TaskResult.Failed, err.message);
    }

}

async function run() {

    try {

        const REPOSITORY_NAME: string = "DevOps_Vault_Reports_Extension";
        const reportNameRandom: string = String(Date.now());
        const inputPathReport: string = tl.getInput('htmlPath', true);
        const inputReportName: string = tl.getInput('nameRepository', true);
        const html = await createReport(inputPathReport);
        await saveReportInRelease(html, `${inputReportName}-+-${reportNameRandom}`);
        await saveReportInRepository(html, REPOSITORY_NAME, inputReportName, reportNameRandom);
        
    }
    catch (err) {

        tl.setResult(tl.TaskResult.Failed, err.message);
    }
}

run();