import { db, storage, auth } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, addDoc, getDocs, deleteDoc, doc, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import imageCompression from 'https://cdn.jsdelivr.net/npm/browser-image-compression@2.0.2/+esm';

// DOM Elements
const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');

const addProjectForm = document.getElementById('add-project-form');
const addTeamForm = document.getElementById('add-team-form');
const projectsList = document.getElementById('admin-projects-list');
const teamList = document.getElementById('admin-team-list');

// Helper to show status messages
function showStatus(element, message, type) {
    element.textContent = message;
    element.className = `status-msg ${type}`;
    setTimeout(() => {
        if (element.textContent === message) {
            element.textContent = '';
            element.className = 'status-msg';
        }
    }, 4000);
}

// Auth State Observer
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in
        loginSection.classList.add('hidden');
        dashboardSection.classList.remove('hidden');
        loadAdminData();
    } else {
        // User is signed out
        loginSection.classList.remove('hidden');
        dashboardSection.classList.add('hidden');
    }
});

// Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorMsg = document.getElementById('login-error');
    const btn = loginForm.querySelector('button');

    try {
        btn.innerHTML = '<i class="fas fa-spinner"></i> Logging in...';
        btn.disabled = true;
        await signInWithEmailAndPassword(auth, email, password);
        loginForm.reset();
        errorMsg.textContent = '';
    } catch (error) {
        console.error("Login error:", error);
        errorMsg.textContent = error.message || "Failed to login. Check credentials.";
    } finally {
        btn.innerHTML = 'Login';
        btn.disabled = false;
    }
});

// Logout
logoutBtn.addEventListener('click', () => {
    signOut(auth).catch((error) => console.error("Logout error:", error));
});

// Load Data for Admin Dashboard
function loadAdminData() {
    loadProjects();
    loadTeam();
}

// --- PROJECT MANAGEMENT ---

// Add Project
addProjectForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-project-btn');
    const statusMsg = document.getElementById('project-status');
    
    const title = document.getElementById('project-title').value.trim();
    const category = document.getElementById('project-category').value;
    const desc = document.getElementById('project-desc').value.trim();
    const fileInput = document.getElementById('project-image');
    const file = fileInput.files[0];

    // Form Validation
    if (!title || !category || !desc) {
        showStatus(statusMsg, "All fields are required.", "error");
        return;
    }
    if (!file) {
        showStatus(statusMsg, "Please select an image.", "error");
        return;
    }
    if (!file.type.startsWith('image/')) {
        showStatus(statusMsg, "Please select a valid image file (JPEG, PNG, etc.).", "error");
        return;
    }

    try {
        btn.innerHTML = '<i class="fas fa-spinner"></i> Optimizing & Uploading...';
        btn.disabled = true;
        statusMsg.textContent = '';

        // Image Compression
        const options = {
            maxSizeMB: 1,
            maxWidthOrHeight: 1920,
            useWebWorker: true
        };
        const compressedFile = await imageCompression(file, options);

        // 1. Upload Image to Storage
        const storageRef = ref(storage, `projects/${Date.now()}_${compressedFile.name}`);
        const snapshot = await uploadBytes(storageRef, compressedFile);
        
        // 2. Get Download URL
        const downloadURL = await getDownloadURL(snapshot.ref);

        // 3. Save to Firestore
        await addDoc(collection(db, "projects"), {
            title: title,
            category: category,
            description: desc,
            imageUrl: downloadURL,
            imagePath: snapshot.ref.fullPath, // Save path for easy deletion later
            timestamp: serverTimestamp()
        });

        showStatus(statusMsg, "Project added successfully!", "success");
        addProjectForm.reset();
        loadProjects(); // Refresh list

    } catch (error) {
        console.error("Error adding project:", error);
        showStatus(statusMsg, "Error: " + error.message, "error");
    } finally {
        btn.innerHTML = 'Add Project';
        btn.disabled = false;
    }
});

// Load Projects List
async function loadProjects() {
    try {
        const q = query(collection(db, "projects"), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            projectsList.innerHTML = '<p>No projects found.</p>';
            return;
        }

        projectsList.innerHTML = '';
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const item = document.createElement('div');
            item.className = 'admin-list-item';
            item.innerHTML = `
                <div class="admin-list-item-info">
                    <img src="${data.imageUrl}" alt="${data.title}">
                    <div>
                        <strong>${data.title}</strong>
                        <div style="font-size: 0.8rem; color: #666;">${data.category}</div>
                    </div>
                </div>
                <button class="btn btn-danger btn-sm delete-project-btn" data-id="${docSnap.id}" data-path="${data.imagePath || ''}">Delete</button>
            `;
            projectsList.appendChild(item);
        });

        // Attach delete listeners
        document.querySelectorAll('.delete-project-btn').forEach(btn => {
            btn.addEventListener('click', handleDeleteProject);
        });

    } catch (error) {
        console.error("Error loading projects:", error);
        projectsList.innerHTML = '<p class="error-msg">Failed to load projects.</p>';
    }
}

// Delete Project
async function handleDeleteProject(e) {
    if (!confirm("Are you sure you want to delete this project? This action cannot be undone.")) return;
    
    const btn = e.target;
    const id = btn.getAttribute('data-id');
    const imagePath = btn.getAttribute('data-path');

    try {
        btn.innerHTML = '<i class="fas fa-spinner"></i> Deleting...';
        btn.disabled = true;

        // 1. Delete from Firestore
        await deleteDoc(doc(db, "projects", id));

        // 2. Delete image from Storage (if path exists)
        if (imagePath) {
            const imageRef = ref(storage, imagePath);
            await deleteObject(imageRef).catch(err => console.log("Image already deleted or not found", err));
        }

        loadProjects(); // Refresh list
    } catch (error) {
        console.error("Error deleting project:", error);
        alert("Failed to delete project: " + error.message);
        btn.innerHTML = 'Delete';
        btn.disabled = false;
    }
}

// --- TEAM MANAGEMENT ---

// Add Team Member
addTeamForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-team-btn');
    const statusMsg = document.getElementById('team-status');
    
    const name = document.getElementById('team-name').value.trim();
    const role = document.getElementById('team-role').value.trim();
    const bio = document.getElementById('team-bio').value.trim();
    const fileInput = document.getElementById('team-photo');
    const file = fileInput.files[0];

    // Form Validation
    if (!name || !role || !bio) {
        showStatus(statusMsg, "All fields are required.", "error");
        return;
    }
    if (!file) {
        showStatus(statusMsg, "Please select a photo.", "error");
        return;
    }
    if (!file.type.startsWith('image/')) {
        showStatus(statusMsg, "Please select a valid image file (JPEG, PNG, etc.).", "error");
        return;
    }

    try {
        btn.innerHTML = '<i class="fas fa-spinner"></i> Optimizing & Uploading...';
        btn.disabled = true;
        statusMsg.textContent = '';

        // Image Compression
        const options = {
            maxSizeMB: 0.5, // Team photos can be smaller
            maxWidthOrHeight: 800,
            useWebWorker: true
        };
        const compressedFile = await imageCompression(file, options);

        // 1. Upload Photo
        const storageRef = ref(storage, `team/${Date.now()}_${compressedFile.name}`);
        const snapshot = await uploadBytes(storageRef, compressedFile);
        
        // 2. Get URL
        const downloadURL = await getDownloadURL(snapshot.ref);

        // 3. Save to Firestore
        await addDoc(collection(db, "team"), {
            name: name,
            role: role,
            bio: bio,
            photoUrl: downloadURL,
            photoPath: snapshot.ref.fullPath,
            timestamp: serverTimestamp()
        });

        showStatus(statusMsg, "Team member added successfully!", "success");
        addTeamForm.reset();
        loadTeam();

    } catch (error) {
        console.error("Error adding team member:", error);
        showStatus(statusMsg, "Error: " + error.message, "error");
    } finally {
        btn.innerHTML = 'Add Member';
        btn.disabled = false;
    }
});

// Load Team List
async function loadTeam() {
    try {
        const querySnapshot = await getDocs(collection(db, "team"));
        
        if (querySnapshot.empty) {
            teamList.innerHTML = '<p>No team members found.</p>';
            return;
        }

        teamList.innerHTML = '';
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const item = document.createElement('div');
            item.className = 'admin-list-item';
            item.innerHTML = `
                <div class="admin-list-item-info">
                    <img src="${data.photoUrl}" alt="${data.name}">
                    <div>
                        <strong>${data.name}</strong>
                        <div style="font-size: 0.8rem; color: #666;">${data.role}</div>
                    </div>
                </div>
                <button class="btn btn-danger btn-sm delete-team-btn" data-id="${docSnap.id}" data-path="${data.photoPath || ''}">Delete</button>
            `;
            teamList.appendChild(item);
        });

        // Attach delete listeners
        document.querySelectorAll('.delete-team-btn').forEach(btn => {
            btn.addEventListener('click', handleDeleteTeam);
        });

    } catch (error) {
        console.error("Error loading team:", error);
        teamList.innerHTML = '<p class="error-msg">Failed to load team.</p>';
    }
}

// Delete Team Member
async function handleDeleteTeam(e) {
    if (!confirm("Are you sure you want to remove this team member? This action cannot be undone.")) return;
    
    const btn = e.target;
    const id = btn.getAttribute('data-id');
    const photoPath = btn.getAttribute('data-path');

    try {
        btn.innerHTML = '<i class="fas fa-spinner"></i> Deleting...';
        btn.disabled = true;

        await deleteDoc(doc(db, "team", id));

        if (photoPath) {
            const photoRef = ref(storage, photoPath);
            await deleteObject(photoRef).catch(err => console.log("Photo already deleted", err));
        }

        loadTeam();
    } catch (error) {
        console.error("Error deleting team member:", error);
        alert("Failed to delete team member: " + error.message);
        btn.innerHTML = 'Delete';
        btn.disabled = false;
    }
}
