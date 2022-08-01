//npm install minimist
//npm install axios
//npm install jsdom
//npm install excel4node
//npm install pdf-lib
//node 1_ProjectScrapping.js --excel=worldcup.xlsx --dataFolder=data --source="https://www.espncricinfo.com/series/icc-cricket-world-cup-2019-1144415/match-results"

let minimist = require("minimist");
let axios = require("axios");
let jsdom = require("jsdom");
let excel4node = require("excel4node");
let pdf = require("pdf-lib");
let args = minimist(process.argv);
let fs = require("fs");
let path = require("path");
/*How to perform the task
download using axios- it promises to give response, and we collect response data for html
Read using jsdm- we get dom tree to use it as per our requirents.
make excel using excel4node
make pdf using pdf-lib*/

//Taking response from axios
let responseKaPromise = axios.get(args.source);
responseKaPromise.then(function(response){
    let html = response.data;
    let dom = new jsdom.JSDOM(html);//jsdom naam ki library me JSDOM naam ka function hai jo html ka dom banata hai
    let document = dom.window.document;
    let matches = [];
    let matchScoreDiv = document.querySelectorAll("div.ds-px-4.ds-py-3");
    for(let i = 0; i < matchScoreDiv.length; i++)
    {
        let match = {
           t1: " ",
           t2: " ",
           t1s: " ",
           t2s: " ",
           result: " "
        };
       let teamParas = matchScoreDiv[i].querySelectorAll("p.ds-text-tight-m.ds-font-bold.ds-capitalize");
        
       match.t1 = teamParas[0].textContent;
       match.t2 = teamParas[1].textContent;
        let scoreSpans = matchScoreDiv[i].querySelectorAll("div.ds-text-compact-s.ds-text-typo-title strong"); 
        if(scoreSpans.length == 2)
        {
            match.t1s = scoreSpans[0].textContent;
            match.t2s = scoreSpans[1].textContent;
        }
        else if(scoreSpans.length == 1)
        {
            match.t1s = scoreSpans[0].textContent;
            match.t2s = "";
        }
        else
        {
            match.t1s = "";
            match.t2s = "";
        }
        let resultSpan = matchScoreDiv[i].querySelector("p.ds-text-tight-s.ds-font-regular.ds-truncate.ds-text-typo-title > span");
        match.result = resultSpan.textContent;
       matches.push(match);
    }

    /*
    Till now we are getting the list of matches, but we want teams array, which contains a team and its all the 
    matches and result
    Now i will use loop of matches and create array of teams.
    */
    let matchesJSON = JSON.stringify(matches);
    fs.writeFileSync("matchess.json", matchesJSON, "utf-8");

    
    let teams = [];

    //push team in teams, if not already there
    for(let i = 0; i < matches.length; i++){
        putTeamInTeamsArrayIfMissing(teams, matches[i].t1);
        putTeamInTeamsArrayIfMissing(teams, matches[i].t2);
    }

    //put match in appropriate team
    for(let i = 0; i < matches.length; i++){
        putmatchInAppropriateTeams(teams, matches[i].t1, matches[i].t2, matches[i].t1s, matches[i].t2s, matches[i].result);
        putmatchInAppropriateTeams(teams, matches[i].t2, matches[i].t1, matches[i].t2s, matches[i].t1s, matches[i].result);
    }
    let teamsJSON = JSON.stringify(teams);
    fs.writeFileSync("teamss.json", teamsJSON, "utf-8");
    createExcelFile(teams);
    prepareFolderAndPdfs(teams, args.dataFolder);
    
}).catch(function(err){
    console.log(err);
})

function prepareFolderAndPdfs(teams, dataDir){
    if(fs.existsSync(dataDir) == true){
        fs.rmdirSync(dataDir, {recursive : true});
    }
    fs.mkdirSync(dataDir);
    for(let i = 0; i < teams.length; i++){
        let teamFolderName = path.join(dataDir, teams[i].name);
        fs.mkdirSync(teamFolderName);
        
        for(let j = 0; j < teams[i].matches.length; j++){
            let match = teams[i].matches[j];
            createMatchScoreCardPdf(teamFolderName,teams[i].name, match);
        }
    }
    
}
function createMatchScoreCardPdf(teamFolderName, homeTeam, match){
    let matchFileName = path.join(teamFolderName, match.vs);
    let templateFileBytes = fs.readFileSync("Template.pdf");
    let pdfdocKaPromise = pdf.PDFDocument.load(templateFileBytes);
    pdfdocKaPromise.then(function(pdfdoc){
        let page = pdfdoc.getPage(0);
        page.drawText(homeTeam,{
            x: 320, 
            y: 690,
            size: 10
        });
        page.drawText(match.vs,{
            x: 320, 
            y: 672,
            size: 10
        });
        page.drawText(match.selfScore,{
            x: 320, 
            y: 655,
            size: 10
        });
        page.drawText(match.oppScore,{
            x: 320, 
            y: 637,
            size: 10
        });
        page.drawText(match.result,{
            x: 320, 
            y: 620,
            size: 10
        });

        let changedBytesKaPromise = pdfdoc.save();
        changedBytesKaPromise.then(function(changedBytes){
           if(fs.existsSync(matchFileName+".pdf") == true){
                fs.writeFileSync(matchFileName+"2.pdf", changedBytes);
           } else{
            fs.writeFileSync(matchFileName+".pdf", changedBytes);
           }
        })
    })
}
function createExcelFile(teams){
    let wb = new excel4node.Workbook();

    for(let i = 0; i < teams.length; i++){
        let sheet = wb.addWorksheet(teams[i].name);

        sheet.cell(1,1).string("vs");
        sheet.cell(1,2).string("Self Score");
        sheet.cell(1,3).string("Opp Score");
        sheet.cell(1,4).string("Result");
        for(let j = 0; j < teams[i].matches.length; j++){
            sheet.cell(2+j, 1).string(teams[i].matches[j].vs);
            sheet.cell(2+j, 2).string(teams[i].matches[j].selfScore);
            sheet.cell(2+j, 3).string(teams[i].matches[j].oppScore);
            sheet.cell(2+j, 4).string(teams[i].matches[j].result);
        }
    }
    wb.write(args.excel);
}
function putTeamInTeamsArrayIfMissing(teams, teamName)
{
    let tidx = -1;
    for(let j = 0; j < teams.length; j++)
    {
        if(teams[j].name == teamName)
        {
            tidx = j;
        }
    }
    if(tidx == -1)
    {
        let team = {
            name : teamName,
            matches:[]
        };
        teams.push(team);
    }
}
function putmatchInAppropriateTeams(teams, homeTeam, oppTeam, homeScore, oppScore, result){
    let tidx = -1;
    for(let j = 0; j < teams.length; j++){
        if(teams[j].name == homeTeam){
            tidx = j;
            break;
        }
    }

    let team = teams[tidx];
    team.matches.push({
        vs: oppTeam,
        selfScore:homeScore, 
        oppScore: oppScore,
        result: result
    });

}
