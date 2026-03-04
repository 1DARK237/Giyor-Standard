import { db } from './firebase-config.js';
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// DOM Elements
const portfolioGrid = document.getElementById('portfolio-grid');
const teamGrid = document.getElementById('team-grid');
const filterBtns = document.querySelectorAll('.filter-btn');

let allProjects = [];

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    fetchProjects();
    fetchTeam();
    setupFilters();
    setupContactForm();
});

// Fetch Projects from Firestore
async function fetchProjects() {
    try {
        const q = query(collection(db, "projects"), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        
        allProjects = [];
        querySnapshot.forEach((doc) => {
            allProjects.push({ id: doc.id, ...doc.data() });
        });

        renderProjects(allProjects);
    } catch (error) {
        console.error("Error fetching projects: ", error);
        
        // Fallback demo data if Firebase is not configured
        if (error.code === 'invalid-argument' || error.code === 'permission-denied' || error.message.includes('API key') || error.message.includes('YOUR_PROJECT_ID')) {
            renderDemoProjects();
        } else {
            portfolioGrid.innerHTML = `<div class="error-msg">Failed to load projects. Please check Firebase configuration.</div>`;
        }
    }
}

// Render Projects
function renderProjects(projects) {
    if (projects.length === 0) {
        portfolioGrid.innerHTML = `<p>No projects found.</p>`;
        return;
    }

    portfolioGrid.innerHTML = projects.map(project => `
        <div class="portfolio-item" data-category="${project.category}">
            <img src="${project.imageUrl}" alt="${project.title}" onerror="this.src='https://picsum.photos/seed/${project.title.replace(/\s/g, '')}/800/600'">
            <div class="portfolio-overlay">
                <h3>${project.title}</h3>
                <p>${project.category}</p>
                <p style="font-size: 0.8rem; margin-top: 10px;">${project.description}</p>
            </div>
        </div>
    `).join('');
}

// Setup Filters
function setupFilters() {
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active class
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Filter projects
            const filterValue = btn.getAttribute('data-filter');
            if (filterValue === 'all') {
                renderProjects(allProjects);
            } else {
                const filtered = allProjects.filter(p => p.category === filterValue);
                renderProjects(filtered);
            }
        });
    });
}

// Fetch Team from Firestore
async function fetchTeam() {
    try {
        const querySnapshot = await getDocs(collection(db, "team"));
        const team = [];
        querySnapshot.forEach((doc) => {
            team.push({ id: doc.id, ...doc.data() });
        });

        renderTeam(team);
    } catch (error) {
        console.error("Error fetching team: ", error);
        
        if (error.code === 'invalid-argument' || error.code === 'permission-denied' || error.message.includes('API key') || error.message.includes('YOUR_PROJECT_ID')) {
            renderDemoTeam();
        } else {
            teamGrid.innerHTML = `<div class="error-msg">Failed to load team. Please check Firebase configuration.</div>`;
        }
    }
}

// Render Team
function renderTeam(team) {
    if (team.length === 0) {
        teamGrid.innerHTML = `<p>No team members found.</p>`;
        return;
    }

    teamGrid.innerHTML = team.map(member => `
        <div class="team-member">
            <img src="${member.photoUrl}" alt="${member.name}" onerror="this.src='https://picsum.photos/seed/${member.name.replace(/\s/g, '')}/400/400'">
            <h3>${member.name}</h3>
            <p class="role">${member.role}</p>
            <p>${member.bio}</p>
        </div>
    `).join('');
}

// Contact Form (Dummy submit)
function setupContactForm() {
    const form = document.getElementById('contact-form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const btn = form.querySelector('button');
            const originalText = btn.textContent;
            btn.textContent = 'Sending...';
            btn.disabled = true;
            
            setTimeout(() => {
                btn.textContent = 'Message Sent!';
                btn.style.backgroundColor = 'var(--success)';
                form.reset();
                
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.backgroundColor = '';
                    btn.disabled = false;
                }, 3000);
            }, 1500);
        });
    }
}

// Demo Data Fallbacks (For preview before Firebase is configured)
function renderDemoProjects() {
    allProjects = [
        { title: "Modern Villa", category: "Residential", description: "A beautiful modern villa with stonework.", imageUrl: "https://picsum.photos/seed/villa/800/600" },
        { title: "City Office", category: "Commercial", description: "Downtown commercial office building.", imageUrl: "https://picsum.photos/seed/office/800/600" },
        { title: "Cozy Cabin", category: "Residential", description: "Wood and stone cabin in the woods.", imageUrl: "https://picsum.photos/seed/cabin/800/600" }
    ];
    renderProjects(allProjects);
}

function renderDemoTeam() {
    const demoTeam = [
        { name: "Sarah Jenkins", role: "Lead Architect", bio: "15 years of experience in sustainable design.", photoUrl: "https://picsum.photos/seed/sarah/400/400" },
        { name: "Michael Chen", role: "Master Stonemason", bio: "Expert in traditional and modern stoneworks.", photoUrl: "https://picsum.photos/seed/michael/400/400" }
    ];
    renderTeam(demoTeam);
}
