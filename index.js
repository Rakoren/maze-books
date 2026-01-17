#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function shuffle(a){for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}

const DIRS = [
	[0,1],[1,0],[0,-1],[-1,0], // orthogonal
	[1,1],[1,-1],[-1,1],[-1,-1] // diagonal
];

function nonBackwardsDirs(){
	// Teacher mode: only allow right and down so words never appear backwards.
	return [ [0,1], [1,0] ];
}

function makeEmptyGrid(n){return Array.from({length:n},()=>Array.from({length:n},()=>null))}

function canPlace(grid, word, r, c, dr, dc){
	const n = grid.length;
	for(let i=0;i<word.length;i++){
		const rr = r + dr*i, cc = c + dc*i;
		if(rr<0||cc<0||rr>=n||cc>=n) return false;
		const ch = grid[rr][cc];
		if(ch && ch !== word[i]) return false;
	}
	return true;
}

function placeWord(grid, word, r, c, dr, dc){
	for(let i=0;i<word.length;i++){
		grid[r+dr*i][c+dc*i] = word[i];
	}
}

function fillGrid(grid){
	const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
	for(let r=0;r<grid.length;r++){
		for(let c=0;c<grid.length;c++){
			if(!grid[r][c]) grid[r][c] = letters[Math.floor(Math.random()*letters.length)];
		}
	}
}

function generate(words, size, opts){
	const n = size || Math.max(10, ...words.map(w=>w.length));
	const grid = makeEmptyGrid(n);
	const placements = [];
	const order = shuffle(words.slice()).sort((a,b)=>b.length-a.length);
	const dirs = (opts && opts.teacher) ? nonBackwardsDirs() : DIRS;

	for(const raw of order){
		const word = raw.toUpperCase().replace(/[^A-Z]/g,'');
		let placed=false;
		const attempts = 200;
		for(let t=0;t<attempts && !placed;t++){
			const dir = dirs[Math.floor(Math.random()*dirs.length)];
			const dr = dir[0], dc = dir[1];
			const r = Math.floor(Math.random()*n);
			const c = Math.floor(Math.random()*n);
			// adjust start so word fits
			const endR = r + dr*(word.length-1);
			const endC = c + dc*(word.length-1);
			if(endR<0||endC<0||endR>=n||endC>=n) continue;
			if(canPlace(grid, word, r, c, dr, dc)){
				placeWord(grid, word, r, c, dr, dc);
				placements.push({word, r, c, dr, dc});
				placed = true;
			}
		}
		if(!placed) console.warn('Could not place', raw);
	}

	fillGrid(grid);
	return {grid, placements};
}

function renderConsole(grid){
	return grid.map(row=>row.join(' ')).join('\n');
}

function renderHTML(grid, placements, title, opts){
	const n = grid.length;
	const cellSize = opts && opts.print ? 44 : 30;
	const letters = grid.map(r=>r.map(c=>c));
	const placedWords = placements.map(p=>p.word);
	const html = [];
	html.push(`<!doctype html><html><head><meta charset="utf-8"><title>${title||'Wordsearch'}</title><style>`);
	html.push(`body{font-family:sans-serif;padding:20px;color:#000} table{border-collapse:collapse;margin:0 auto}`);
	html.push(`td{width:${cellSize}px;height:${cellSize}px;text-align:center;border:1px solid #999;font-weight:700;font-size:${Math.floor(cellSize*0.5)}px}`);
	html.push(`.list{margin-top:16px}`);
	if(opts && opts.print){
		html.push(`@media print{ @page {size: landscape; margin: 10mm;} .list{display:none} body{padding:0} }`);
	}
	html.push(`</style></head><body>`);
	html.push(`<h1>${title||'Wordsearch'}</h1>`);
	html.push('<table>');
	for(let r=0;r<n;r++){
		html.push('<tr>');
		for(let c=0;c<n;c++) html.push(`<td>${letters[r][c]}</td>`);
		html.push('</tr>');
	}
	html.push('</table>');
	if(!(opts && opts.print)){
		html.push('<div style="text-align:center;margin:12px 0"><button id="toggleWords">Toggle Word List</button></div>');
		html.push('<div class="list" style="margin-top:16px"><strong>Words:</strong><ul>');
		for(const w of placedWords) html.push(`<li>${w}</li>`);
		html.push('</ul></div>');
		html.push(`<script>document.getElementById('toggleWords').addEventListener('click',function(){var l=document.querySelector('.list'); if(!l) return; l.style.display = (l.style.display==='none') ? 'block' : 'none';});</script>`);
	}
	html.push('</body></html>');
	return html.join('\n');
}

function loadThemes(){
	const p = path.join(process.cwd(),'themes.json');
	try{const raw = fs.readFileSync(p,'utf8'); return JSON.parse(raw)}catch(e){return{}};
}

function usage(){
	console.log('Usage: node index.js --theme=animals --size=15 --html=out.html');
	console.log('Or: node index.js --words="cat,dog,fish" --size=12 --html=out.html');
}

function parseArgs(){
	const args = process.argv.slice(2);
	const opts = {};
	for(const a of args){
		if(a.startsWith('--')){
			const [k,v] = a.slice(2).split('='); opts[k]=v===undefined?true:v;
		}
	}
	return opts;
}

// dynamic age presets will be loaded from themes.json; this function looks them up
function ageToOptions(age, themesObj){
	if(!age || !themesObj) return null;
	const map = themesObj.agePresets || themesObj.agePresets;
	return (map && map[age]) ? map[age] : null;
}

function main(){
	const opts = parseArgs();
	if(opts.help) return usage();
	const themesObj = loadThemes();
	const themes = (themesObj && themesObj.themes) ? themesObj.themes : themesObj || {};
	let words = [];
	if(opts.theme){
		const t = themes[opts.theme];
		if(!t) {console.error('Theme not found:',opts.theme); process.exit(1)}
		words = t.slice();
	}
	if(opts.words){
		words = words.concat(opts.words.split(/[,;\n]+/).map(s=>s.trim()).filter(Boolean));
	}
	if(words.length===0){usage(); process.exit(1)}
	// apply age presets if provided (from themes.json)
	const ageOpts = opts.age ? ageToOptions(opts.age, themesObj) : null;
	let size = parseInt(opts.size||Math.max(10, ...words.map(w=>w.length))) || Math.max(10,...words.map(w=>w.length));
	let teacherFlag = !!opts.teacher;
	if(ageOpts){
		size = ageOpts.size;
		teacherFlag = !!ageOpts.teacher;
		if(ageOpts.maxWords && words.length > ageOpts.maxWords) words = shuffle(words).slice(0, ageOpts.maxWords);
	}
	const {grid, placements} = generate(words, size, {teacher: teacherFlag});
	console.log(renderConsole(grid));
	console.log('\nWords:');
	console.log(words.map(w=>w.toUpperCase()).join(', '));
	if(opts.html){
		const out = renderHTML(grid, placements, opts.title||`Wordsearch: ${opts.theme||'custom'}`, {print: !!opts.print});
		fs.writeFileSync(opts.html, out, 'utf8');
		console.log('Wrote HTML to', opts.html);
	}
}

if(require.main === module) main();

