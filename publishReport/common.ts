import * as vm from 'azure-devops-node-api';
import * as lim from 'azure-devops-node-api/interfaces/LocationsInterfaces';
import tl = require('azure-pipelines-task-lib/task');

function getEnv(name: string): string {
   
    let val = tl.getVariable(name);
    if (!val) {
        console.error(name + ' env var not set');
        tl.setResult(tl.TaskResult.Failed, "env var not set");
        process.exit(1);
    }
    return val;
    
}

export async function getWebApi(): Promise<vm.WebApi> {
    let serverUrl = getEnv('SYSTEM_TEAMFOUNDATIONCOLLECTIONURI');
    return await getApi(serverUrl);
}

export async function getApi(serverUrl: string): Promise<vm.WebApi> {
    return new Promise<vm.WebApi>(async (resolve, reject) => {
        try {
            let token = getEnv('SYSTEM_ACCESSTOKEN');
            let authHandler = vm.getBearerHandler(token);
            let option = undefined;

            let vsts: vm.WebApi = new vm.WebApi(serverUrl, authHandler, option);
            let connData: lim.ConnectionData = await vsts.connect();
            resolve(vsts);
        }
        catch (err) {
            reject(err);
        }
    });
}

export function getProject(): string {
    return getEnv('SYSTEM_TEAMPROJECTID');
}

export function banner(title: string): void {
    console.log();
    console.log('=======================================');
    console.log('\t' + title);
    console.log('=======================================');
    console.log();
}

export function heading(title: string): void {
    console.log();
    console.log('> ' + title);
}
