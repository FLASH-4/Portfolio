# 🌍 3D Solar System Portfolio

An interactive 3D portfolio showcasing a realistic solar system with live GitHub integration, interactive games, and recruiter information.

## ✨ Features

- **Realistic 3D Planets** – Procedurally-generated textures, PBR materials, and dynamic lighting
- **Interactive Solar System** – Orbit controls to explore planets and zoom around the sun
- **Live GitHub Integration** – Auto-refreshing repositories, stats, and deployment status
- **Interactive Games**
  - **Quiz** – 10 technical questions, random 3 per session
  - **Challenge (Neon Code Sprint)** – 8 decision-making rounds, random 3 per session with scoring
- **Recruiter Information** – About, Skills, Projects, GitHub stats, Contact, and more
- **Responsive Design** – Beautiful UI with Tailwind CSS and smooth animations

## 🚀 Tech Stack

- **React** – UI framework
- **Vite** – Build tool & dev server
- **Three.js** – 3D rendering
- **@react-three/fiber** – React renderer for Three.js
- **@react-three/drei** – Utilities for Three.js
- **Tailwind CSS** – Styling
- **GitHub API** – Live data fetching

## 📦 Installation

```bash
git clone https://github.com/YOUR-USERNAME/my-3d-portfolio.git
cd my-3d-portfolio
npm install
```

## 🏃 Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## 🔧 Environment Variables (Optional)

Create a `.env.local` file for enhanced features:

```env
VITE_GITHUB_TOKEN=your_github_token_here
```

This increases GitHub API rate limits from 60 to 5000 requests/hour.

## 📚 Building for Production

```bash
npm run build
npm run preview
```

## 🌐 Deployment

This project is optimized for **GitHub Pages** with custom domain support.

### Deploy to GitHub Pages

1. Push to GitHub:
   ```bash
   git push -u origin main
   ```

2. Go to repository **Settings** → **Pages**

3. Select **Source**: Deploy from a branch
   - Branch: `main`
   - Folder: `/dist`

4. Save and wait ~1 minute for deployment

5. Your site will be live at: `https://your-username.github.io/my-3d-portfolio`

### Use a Custom Domain (Free)

1. **Get a free domain** from [Freenom](https://www.freenom.com)
   - Domains like `.tk`, `.ml`, `.ga` are free for 12 months

2. **Add domain to GitHub Pages**:
   - In repo Settings → Pages → Custom domain
   - Enter your domain (e.g., `myportfolio.tk`)

3. **Point domain to GitHub**:
   - In Freenom dashboard, go to Manage Domain → Management Tools → Nameservers
   - Set nameservers to GitHub's DNS:
     - `ns-1345.awsdns-40.org`
     - `ns-1802.awsdns-32.co.uk`
     - `ns-354.awsdns-44.com`
     - `ns-842.awsdns-31.net`

4. Wait 24-48 hours for DNS propagation

## 🎮 Interact with Your Portfolio

- **Click planets** – Open recruiter information and interactive panels
- **Play Quiz** – Answer 3 random technical questions
- **Play Challenge** – Make 3 strategic decisions, track score and streak
- **View Projects** – See live GitHub repositories (deployed and non-deployed)
- **Check GitHub Stats** – Real-time follower count and repo statistics

## 📝 Customize

Edit `src/App.jsx` to customize:
- Recruiter information in the About panel
- Skills and contact details
- Quiz questions and Challenge rounds
- Planet positions and sizes

## 📄 License

MIT – Free to use and modify

## 🤝 Contributing

Suggestions? Feel free to fork and submit PRs!

---

Built with ❤️ for recruiters and developers
