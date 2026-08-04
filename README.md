# EagleBABA Astro Levels

prepair this html code to premium dashboard and auto update on Nifty50 Previous working day Closing Price, High, Low aur aise hi BankNifty me bhi auto updated hona chahiye



<!DOCTYPE html> <html lang="en"> <head> <meta charset="UTF-8"> <meta name="viewport" content="width=device-width, initial-scale=1.0"> <title>EagleBABA — Nifty & BankNifty Astro Levels</title> <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Share+Tech+Mono&family=Bebas+Neue&display=swap" rel="stylesheet"> <style> :root { --bg:#03060d; --bg2:#070d1a; --bg3:#0b1525; --card:#0d1b2e; --border:#1a2f4a; --accent:#f0a500; --accent2:#e05c2a; --bull:#00c97a; --bear:#ff3a5c; --neutral:#7ec8e3; --text:#cdd8e8; --muted:#5a7a9a; --bn:#7b6cf6; --mono:'Share Tech Mono',monospace; --head:'Bebas Neue',sans-serif; --body:'Rajdhani',sans-serif; } *{margin:0;padding:0;box-sizing:border-box;} body{background:var(--bg);color:var(--text);font-family:var(--body);min-height:100vh;overflow-x:hidden;} body::before{content:'';position:fixed;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.07) 2px,rgba(0,0,0,0.07) 4px);pointer-events:none;z-index:1000;}

header{display:flex;align-items:center;justify-content:space-between;padding:14px 28px;border-bottom:1px solid var(--border);background:linear-gradient(135deg,#050e1e,#091424);position:sticky;top:0;z-index:500;} .logo{font-family:var(--head);font-size:26px;letter-spacing:3px;color:var(--accent);text-shadow:0 0 18px rgba(240,165,0,0.4);} .logo span{color:var(--accent2);} .hright{display:flex;gap:20px;align-items:center;font-family:var(--mono);font-size:12px;color:var(--muted);} .live-dot{width:7px;height:7px;border-radius:50%;background:var(--bull);box-shadow:0 0 7px var(--bull);animation:pulse 1.5s infinite;display:inline-block;margin-right:5px;} @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.3;}}



.tabs{display:flex;background:var(--bg2);border-bottom:2px solid var(--border);} .tab{padding:12px 34px;font-family:var(--head);font-size:18px;letter-spacing:2px;cursor:pointer;border-bottom:3px solid transparent;color:var(--muted);transition:all .2s;user-select:none;margin-bottom:-2px;} .tab:hover{color:var(--text);} .tab.t-nifty{color:var(--accent);border-bottom-color:var(--accent);} .tab.t-bn{color:var(--bn);border-bottom-color:var(--bn);} .tbadge{font-size:10px;font-family:var(--mono);margin-left:7px;padding:1px 5px;border-radius:3px;background:rgba(255,255,255,0.05);}



.inputbar{background:var(--bg2);padding:10px 24px;display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;border-bottom:1px solid var(--border);} .ibf{display:flex;flex-direction:column;gap:3px;} .ibf label{font-size:10px;color:var(--muted);font-family:var(--mono);letter-spacing:.5px;text-transform:uppercase;} .ibf input{background:var(--bg3);border:1px solid var(--border);color:var(--text);padding:5px 8px;border-radius:4px;font-family:var(--mono);font-size:13px;width:125px;} .ibf input[type=date]{color:var(--accent);cursor:pointer;width:140px;} .ibf input:focus{outline:none;} .ibf.ni input:focus{border-color:var(--accent);} .ibf.bn input:focus{border-color:var(--bn);} .sep{width:1px;background:var(--border);align-self:stretch;margin:0 2px;} .btn{padding:6px 16px;border-radius:4px;border:none;cursor:pointer;font-family:var(--body);font-size:14px;font-weight:600;letter-spacing:1px;transition:all .2s;align-self:flex-end;} .btn-ni{background:var(--accent);color:#000;} .btn-ni:hover{background:#ffc83a;box-shadow:0 0 10px rgba(240,165,0,0.4);} .btn-bn{background:var(--bn);color:#fff;} .btn-bn:hover{background:#9d8fff;box-shadow:0 0 10px rgba(123,108,246,0.4);} .btn-rst{background:var(--bg3);color:var(--muted);border:1px solid var(--border);align-self:flex-end;} .btn-rst:hover{border-color:var(--neutral);color:var(--neutral);} .spinner{display:none;width:15px;height:15px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite;align-self:center;} @keyframes spin{to{transform:rotate(360deg);}}



.main{padding:14px 18px;}



.shared-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;}



.panel{display:none;} .panel.on{display:block;}



.top-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;} .side-col{display:flex;flex-direction:column;gap:12px;}



.card{background:var(--card);border:1px solid var(--border);border-radius:8px;overflow:hidden;} .card-h{padding:9px 13px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;} .ni-card .card-h{background:linear-gradient(90deg,rgba(240,165,0,0.09),transparent 60%);} .bn-card .card-h{background:linear-gradient(90deg,rgba(123,108,246,0.09),transparent 60%);} .sh-card .card-h{background:linear-gradient(90deg,rgba(126,200,227,0.07),transparent 60%);} .ct{font-family:var(--head);font-size:15px;letter-spacing:2px;} .ni-card .ct{color:var(--accent);} .bn-card .ct{color:var(--bn);} .sh-card .ct{color:var(--neutral);} .cb{font-family:var(--mono);font-size:10px;padding:2px 6px;border-radius:3px;background:rgba(255,255,255,0.04);color:var(--muted);} .card-b{padding:12px 13px;}



.cpr-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);} .cpr-row:last-child{border-bottom:none;} .cn{font-size:12px;color:var(--muted);font-family:var(--mono);} .cv{font-family:var(--mono);font-size:15px;font-weight:700;} .tc{color:var(--bull);} .pp{color:var(--accent);} .pp-bn{color:var(--bn);} .bc{color:var(--bear);} .cw-row{display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding-top:8px;border-top:1px solid var(--border);} .cw-label{font-size:10px;color:var(--muted);font-family:var(--mono);} .cw-narrow{color:var(--bear)!important;} .cw-wide{color:var(--bull)!important;}



.safe-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;} .sb{padding:9px;border-radius:5px;text-align:center;} .sbuy{background:rgba(0,201,122,0.08);border:1px solid rgba(0,201,122,0.22);} .ssell{background:rgba(255,58,92,0.08);border:1px solid rgba(255,58,92,0.22);} .sl{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;} .sv{font-family:var(--mono);font-size:16px;font-weight:700;margin-top:3px;} .sbuy .sv{color:var(--bull);} .ssell .sv{color:var(--bear);}



.zone-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px;} .zi{display:flex;justify-content:space-between;align-items:center;padding:4px 7px;border-radius:3px;background:rgba(255,255,255,0.02);border:1px solid var(--border);font-family:var(--mono);font-size:11px;} .za{border-left:2px solid var(--bull);} .zb{border-left:2px solid var(--bear);} .zl{color:var(--muted);font-size:10px;}



table{width:100%;border-collapse:collapse;} th{padding:6px 9px;text-align:left;font-size:10px;color:var(--muted);font-family:var(--mono);letter-spacing:.8px;border-bottom:1px solid var(--border);font-weight:normal;text-transform:uppercase;} td{padding:5px 9px;font-family:var(--mono);font-size:12px;border-bottom:1px solid rgba(255,255,255,0.025);transition:background .12s;} tr:hover td{background:rgba(255,255,255,0.025);} .r1,.r2{color:var(--bull);} .s1,.s2{color:var(--bear);} .pl-sun{color:#ffd700;} .pl-moon{color:#c8e6ff;} .pl-mars{color:#ff6b6b;} .pl-mer{color:#90ee90;} .pl-jup{color:#ffa500;} .pl-ven{color:#ffb6c1;} .pl-sat{color:#b0b0d0;} .pl-rahu{color:#a78bfa;} .pl-ketu{color:#f97316;}



.naks-name{font-family:var(--head);font-size:28px;letter-spacing:3px;color:var(--neutral);text-align:center;margin-bottom:3px;} .naks-sub{text-align:center;color:var(--muted);font-family:var(--mono);font-size:11px;margin-bottom:10px;} .naks-info{text-align:center;font-size:11px;color:var(--neutral);margin-bottom:10px;} .naks-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;} .nbox{padding:8px;border-radius:5px;text-align:center;background:rgba(255,255,255,0.025);border:1px solid var(--border);} .nbox-l{font-size:10px;color:var(--muted);letter-spacing:.8px;text-transform:uppercase;margin-bottom:2px;} .nbox-v{font-size:14px;font-weight:700;font-family:var(--mono);}



.sig-box{padding:12px;text-align:center;border-radius:6px;border:1px solid;margin-bottom:9px;} .sig-bull{background:rgba(0,201,122,0.07);border-color:rgba(0,201,122,0.28);} .sig-bear{background:rgba(255,58,92,0.07);border-color:rgba(255,58,92,0.28);} .sig-lbl{font-family:var(--head);font-size:21px;letter-spacing:3px;} .sig-sub{font-size:11px;color:var(--muted);margin-top:2px;} .sig-note{font-size:11px;color:var(--muted);font-family:var(--mono);padding:7px 10px;background:rgba(255,255,255,0.02);border-radius:5px;line-height:1.5;}



.empty{text-align:center;padding:20px;color:var(--muted);font-family:var(--mono);font-size:12px;}



#statusBar{padding:6px 24px;font-family:var(--mono);font-size:11px;color:var(--muted);border-top:1px solid var(--border);background:var(--bg2);display:flex;justify-content:space-between;} .ok{color:var(--bull)!important;} .err{color:var(--bear)!important;}



@media(max-width:820px){ .shared-row,.top-row{grid-template-columns:1fr;} .tab{padding:10px 16px;font-size:15px;} .inputbar{gap:10px;} .ibf input{width:108px;} }



EagleBABA  ·  ASTRO LEVELS



NSE INDIA

--:--:-- IST

--

NIFTY 50 INDEX



BANKNIFTY INDEX



Trading Date





















  Nifty Prev Close

  













  Nifty Prev High

  













  Nifty Prev Low

  







▶ NIFTY LEVELS



















  BankNifty Prev Close

  













  BankNifty Prev High

  













  BankNifty Prev Low

  







▶ BANKNIFTY LEVELS

↺ RESET



NAKSHATRA—



Select date → Compute



MARKET SIGNAL—



Awaiting computation...



NIFTY — CPR LEVELSPP · TC · BC



Enter OHLC → Compute



SAFE ZONES±100 pts



—



GANN 360° ZONES±360 pts



—



NIFTY 50 — GANN PLANET LEVELSL1=R1 · L2=S1 · L3=R2 · L4=S2



Enter NIFTY OHLC → Compute



BANKNIFTY — CPR LEVELSPP · TC · BC



Enter OHLC → Compute



SAFE ZONES±300 pts



—



GANN 360° ZONES±360 pts



—



BANKNIFTY — GANN PLANET LEVELSL1=R1 · L2=S1 · L3=R2 · L4=S2



Enter BANKNIFTY OHLC → Compute



Ready. Select tab → enter OHLC → Compute Levels.—

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://eagle13.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f4a2101a-f000-4711-8413-ff7281617ea4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
