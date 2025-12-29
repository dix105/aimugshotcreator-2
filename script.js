/**
 * AI Mugshot Maker - Main Script
 * Handles uploads, UI interactions, and REAL backend processing.
 */

(function() {
    'use strict';
    
    // ------------------------------------------------------------------------
    // API CONFIGURATION & STATE
    // ------------------------------------------------------------------------
    const USER_ID = 'DObRu1vyStbUynoQmTcHBlhs55z2';
    const MODEL = 'image-effects';
    const EFFECT_ID = 'mugshot';
    const TOOL_TYPE = 'image-effects';
    
    let currentUploadedUrl = null;

    // ------------------------------------------------------------------------
    // CORE API FUNCTIONS (REQUIRED)
    // ------------------------------------------------------------------------

    // Generate nanoid for unique filename
    function generateNanoId(length = 21) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // Upload file to CDN storage (called immediately when file is selected)
    async function uploadFile(file) {
        const fileExtension = file.name.split('.').pop() || 'jpg';
        const uniqueId = generateNanoId();
        // Filename is just nanoid.extension (no media/ prefix)
        const fileName = uniqueId + '.' + fileExtension;
        
        // Step 1: Get signed URL from API
        const signedUrlResponse = await fetch(
            'https://api.chromastudio.ai/get-emd-upload-url?fileName=' + encodeURIComponent(fileName),
            { method: 'GET' }
        );
        
        if (!signedUrlResponse.ok) {
            throw new Error('Failed to get signed URL: ' + signedUrlResponse.statusText);
        }
        
        const signedUrl = await signedUrlResponse.text();
        
        // Step 2: PUT file to signed URL
        const uploadResponse = await fetch(signedUrl, {
            method: 'PUT',
            body: file,
            headers: {
                'Content-Type': file.type
            }
        });
        
        if (!uploadResponse.ok) {
            throw new Error('Failed to upload file: ' + uploadResponse.statusText);
        }
        
        // Step 3: Return download URL
        const downloadUrl = 'https://contents.maxstudio.ai/' + fileName;
        return downloadUrl;
    }

    // Submit generation job (Image)
    async function submitImageGenJob(imageUrl) {
        const isVideo = MODEL === 'video-effects'; // False for mugshot
        const endpoint = isVideo ? 'https://api.chromastudio.ai/video-gen' : 'https://api.chromastudio.ai/image-gen';
        
        const headers = {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            'sec-ch-ua-platform': '"Windows"',
            'sec-ch-ua': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
            'sec-ch-ua-mobile': '?0'
        };

        const body = {
            model: MODEL,
            toolType: TOOL_TYPE,
            effectId: EFFECT_ID,
            imageUrl: imageUrl, 
            userId: USER_ID,
            removeWatermark: true,
            isPrivate: true
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });
        
        if (!response.ok) {
            throw new Error('Failed to submit job: ' + response.statusText);
        }
        
        const data = await response.json();
        return data;
    }

    // Poll job status until completed or failed
    const POLL_INTERVAL = 2000; // 2 seconds
    const MAX_POLLS = 60; // Max 2 minutes

    async function pollJobStatus(jobId) {
        const isVideo = MODEL === 'video-effects';
        const baseUrl = isVideo ? 'https://api.chromastudio.ai/video-gen' : 'https://api.chromastudio.ai/image-gen';
        let polls = 0;
        
        while (polls < MAX_POLLS) {
            const response = await fetch(
                `${baseUrl}/${USER_ID}/${jobId}/status`,
                {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json, text/plain, */*'
                    }
                }
            );
            
            if (!response.ok) {
                throw new Error('Failed to check status: ' + response.statusText);
            }
            
            const data = await response.json();
            
            if (data.status === 'completed') {
                return data;
            }
            
            if (data.status === 'failed' || data.status === 'error') {
                throw new Error(data.error || 'Job processing failed');
            }
            
            // Update UI with progress
            updateStatus('PROCESSING... (' + (polls + 1) + ')');
            
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
            polls++;
        }
        
        throw new Error('Job timed out after ' + MAX_POLLS + ' polls');
    }

    // ------------------------------------------------------------------------
    // UI HELPERS
    // ------------------------------------------------------------------------

    function showLoading() {
        const loader = document.getElementById('loading-state');
        const generateBtn = document.getElementById('generate-btn');
        const placeholder = document.querySelector('.placeholder-content');
        const resultImg = document.getElementById('result-final');
        const resultVideo = document.getElementById('result-video');

        if (loader) loader.classList.remove('hidden');
        if (generateBtn) {
            generateBtn.disabled = true;
            generateBtn.setAttribute('aria-busy', 'true');
        }
        if (placeholder) placeholder.classList.add('hidden');
        if (resultImg) resultImg.classList.add('hidden');
        if (resultVideo) resultVideo.style.display = 'none';
    }

    function hideLoading() {
        const loader = document.getElementById('loading-state');
        const generateBtn = document.getElementById('generate-btn');

        if (loader) loader.classList.add('hidden');
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.setAttribute('aria-busy', 'false');
        }
    }

    function updateStatus(text) {
        const generateBtn = document.getElementById('generate-btn');
        if (generateBtn) {
            generateBtn.textContent = text;
        }
        
        const statusText = document.getElementById('status-text');
        if (statusText) statusText.textContent = text;
    }

    function showError(msg) {
        const errorDiv = document.getElementById('error-message');
        if (errorDiv) {
            errorDiv.textContent = msg;
            errorDiv.style.display = 'block';
            errorDiv.style.color = 'red';
            setTimeout(() => { errorDiv.style.display = 'none'; }, 5000);
        } else {
            alert('Error: ' + msg);
        }
    }

    function showPreview(url) {
        const img = document.getElementById('preview-image');
        const uploadContent = document.querySelector('.upload-content');
        const resetBtn = document.getElementById('reset-btn');
        const generateBtn = document.getElementById('generate-btn');

        if (img) {
            img.src = url;
            img.classList.remove('hidden');
        }
        if (uploadContent) uploadContent.classList.add('hidden');
        
        if (resetBtn) resetBtn.disabled = false;
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.textContent = 'Generate Mugshot';
        }
    }

    function showResultMedia(url) {
        const resultImg = document.getElementById('result-final');
        const container = resultImg ? resultImg.parentElement : document.querySelector('.result-area');
        
        if (!container) return;
        
        const isVideo = url.toLowerCase().match(/\.(mp4|webm)(\?.*)?$/i);
        
        if (isVideo) {
            if (resultImg) resultImg.classList.add('hidden');
            
            let video = document.getElementById('result-video');
            if (!video) {
                video = document.createElement('video');
                video.id = 'result-video';
                video.controls = true;
                video.autoplay = true;
                video.loop = true;
                video.className = resultImg ? resultImg.className : 'w-full h-auto rounded-lg';
                video.style.maxWidth = '100%';
                container.appendChild(video);
            }
            video.src = url;
            video.style.display = 'block';
            video.classList.remove('hidden');
        } else {
            const video = document.getElementById('result-video');
            if (video) video.style.display = 'none';
            
            if (resultImg) {
                resultImg.classList.remove('hidden');
                resultImg.crossOrigin = 'anonymous';
                resultImg.src = url;
            }
        }
    }

    function showDownloadButton(url) {
        const downloadBtn = document.getElementById('download-btn');
        if (downloadBtn) {
            downloadBtn.dataset.url = url;
            downloadBtn.classList.remove('disabled');
            downloadBtn.setAttribute('aria-disabled', 'false');
            downloadBtn.style.display = 'inline-block';
        }
    }

    // ------------------------------------------------------------------------
    // HANDLERS
    // ------------------------------------------------------------------------

    // Handler when file is selected - uploads immediately
    async function handleFileSelect(file) {
        try {
            // Validations
            if (!file.type.startsWith('image/')) {
                showError('Please upload a valid image file (JPEG, PNG).');
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                showError('File is too large. Max size is 10MB.');
                return;
            }

            // Show local preview immediately while uploading
            const reader = new FileReader();
            reader.onload = (e) => showPreview(e.target.result);
            reader.readAsDataURL(file);

            updateStatus('UPLOADING...');
            const generateBtn = document.getElementById('generate-btn');
            if (generateBtn) generateBtn.disabled = true;
            
            // Upload immediately
            const uploadedUrl = await uploadFile(file);
            currentUploadedUrl = uploadedUrl;
            
            updateStatus('GENERATE MUGSHOT');
            if (generateBtn) generateBtn.disabled = false;
            
        } catch (error) {
            updateStatus('ERROR');
            showError(error.message);
        }
    }

    // Handler when Generate button is clicked
    async function handleGenerate() {
        if (!currentUploadedUrl) {
            showError('Please upload an image first.');
            return;
        }
        
        try {
            showLoading();
            updateStatus('SUBMITTING...');
            
            // Step 1: Submit job
            const jobData = await submitImageGenJob(currentUploadedUrl);
            
            updateStatus('QUEUED...');
            
            // Step 2: Poll for completion
            const result = await pollJobStatus(jobData.jobId);
            
            // Step 3: Get result URL
            const resultItem = Array.isArray(result.result) ? result.result[0] : result.result;
            const resultUrl = resultItem?.mediaUrl || resultItem?.video || resultItem?.image;
            
            if (!resultUrl) {
                console.error('Response:', result);
                throw new Error('No image URL in response');
            }
            
            // Step 4: Display result
            showResultMedia(resultUrl);
            
            updateStatus('COMPLETE');
            hideLoading();
            
            // Re-enable generate button text
            const generateBtn = document.getElementById('generate-btn');
            if(generateBtn) generateBtn.textContent = "GENERATE MUGSHOT";
            
            showDownloadButton(resultUrl);
            
        } catch (error) {
            hideLoading();
            updateStatus('ERROR');
            showError(error.message);
        }
    }

    // ------------------------------------------------------------------------
    // APP INITIALIZATION
    // ------------------------------------------------------------------------
    
    const App = {
        init() {
            this.initMobileMenu();
            this.initFAQ();
            this.initModals();
            this.initScrollAnimations();
            this.initFileUpload();
            this.initPlaygroundActions();
        },
        
        // --- Existing UI Logic ---
        
        initMobileMenu() {
            const menuToggle = document.querySelector('.menu-toggle');
            const nav = document.querySelector('header nav');
            if (menuToggle && nav) {
                menuToggle.addEventListener('click', () => {
                    const isActive = nav.classList.toggle('active');
                    menuToggle.textContent = isActive ? '✕' : '☰';
                    menuToggle.setAttribute('aria-expanded', isActive);
                });
                nav.querySelectorAll('a').forEach(link => {
                    link.addEventListener('click', () => {
                        nav.classList.remove('active');
                        menuToggle.textContent = '☰';
                        menuToggle.setAttribute('aria-expanded', 'false');
                    });
                });
            }
        },
        
        initFAQ() {
            const faqQuestions = document.querySelectorAll('.faq-question');
            faqQuestions.forEach(question => {
                question.addEventListener('click', () => {
                    const isExpanded = question.getAttribute('aria-expanded') === 'true';
                    faqQuestions.forEach(q => {
                        if (q !== question) {
                            q.setAttribute('aria-expanded', 'false');
                            q.nextElementSibling.classList.remove('active');
                            q.nextElementSibling.style.maxHeight = null;
                        }
                    });
                    question.setAttribute('aria-expanded', !isExpanded);
                    const answer = question.nextElementSibling;
                    answer.classList.toggle('active');
                    answer.style.maxHeight = !isExpanded ? answer.scrollHeight + "px" : null;
                });
            });
        },
        
        initModals() {
            const openBtns = document.querySelectorAll('[data-modal-target]');
            const closeBtns = document.querySelectorAll('[data-modal-close]');
            
            openBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const modalId = btn.getAttribute('data-modal-target');
                    const modal = document.getElementById(modalId);
                    if (modal) {
                        modal.classList.remove('hidden');
                        modal.setAttribute('aria-hidden', 'false');
                        document.body.style.overflow = 'hidden';
                    }
                });
            });
            
            closeBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const modal = btn.closest('.modal');
                    this.closeModal(modal);
                });
            });
            
            window.addEventListener('click', (e) => {
                if (e.target.classList.contains('modal')) {
                    this.closeModal(e.target);
                }
            });
            
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    const openModal = document.querySelector('.modal:not(.hidden)');
                    if (openModal) this.closeModal(openModal);
                }
            });
        },
        
        closeModal(modal) {
            if (modal) {
                modal.classList.add('hidden');
                modal.setAttribute('aria-hidden', 'true');
                document.body.style.overflow = '';
            }
        },
        
        initScrollAnimations() {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('fade-in-up');
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.1 });
            
            document.querySelectorAll('section, .step-card, .gallery-item, .testimonial-card').forEach(el => {
                el.style.opacity = '0';
                observer.observe(el);
            });
        },
        
        // --- Wired File Upload & Actions ---
        
        initFileUpload() {
            const dropZone = document.getElementById('upload-zone');
            const fileInput = document.getElementById('file-input');
            const resetBtn = document.getElementById('reset-btn');
            
            if (fileInput) {
                fileInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) handleFileSelect(file);
                });
            }
            
            if (dropZone) {
                dropZone.addEventListener('click', () => fileInput && fileInput.click());
                
                dropZone.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    dropZone.style.borderColor = 'var(--primary)';
                    dropZone.style.background = 'color-mix(in srgb, var(--primary) 10%, white)';
                });
                
                dropZone.addEventListener('dragleave', () => {
                    dropZone.style.borderColor = '';
                    dropZone.style.background = '';
                });
                
                dropZone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    dropZone.style.borderColor = '';
                    dropZone.style.background = '';
                    const file = e.dataTransfer.files[0];
                    if (file) handleFileSelect(file);
                });
            }
            
            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    currentUploadedUrl = null;
                    if (fileInput) fileInput.value = '';
                    
                    const previewImg = document.getElementById('preview-image');
                    if (previewImg) {
                        previewImg.src = '';
                        previewImg.classList.add('hidden');
                    }
                    
                    const uploadContent = document.querySelector('.upload-content');
                    if (uploadContent) uploadContent.classList.remove('hidden');
                    
                    const resultImg = document.getElementById('result-final');
                    if (resultImg) resultImg.classList.add('hidden');
                    
                    const resultVideo = document.getElementById('result-video');
                    if (resultVideo) resultVideo.style.display = 'none';
                    
                    const placeholder = document.querySelector('.placeholder-content');
                    if (placeholder) placeholder.classList.remove('hidden');
                    
                    resetBtn.disabled = true;
                    
                    const generateBtn = document.getElementById('generate-btn');
                    if (generateBtn) {
                        generateBtn.disabled = true;
                        generateBtn.textContent = 'Generate Mugshot';
                    }
                    
                    const downloadBtn = document.getElementById('download-btn');
                    if (downloadBtn) {
                        downloadBtn.classList.add('disabled');
                        delete downloadBtn.dataset.url;
                    }
                });
            }
        },
        
        initPlaygroundActions() {
            // Generate Button
            const generateBtn = document.getElementById('generate-btn');
            if (generateBtn) {
                generateBtn.addEventListener('click', handleGenerate);
            }
            
            // Download Button Logic (Robust)
            const downloadBtn = document.getElementById('download-btn');
            if (downloadBtn) {
                downloadBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    const url = downloadBtn.dataset.url;
                    if (!url) return;
                    
                    const originalText = downloadBtn.textContent;
                    downloadBtn.textContent = 'Downloading...';
                    downloadBtn.classList.add('disabled');
                    
                    try {
                        // Strategy 1: Fetch as blob to force download
                        const response = await fetch(url, {
                            mode: 'cors',
                            credentials: 'omit'
                        });
                        
                        if (!response.ok) throw new Error('Fetch failed');
                        
                        const blob = await response.blob();
                        const blobUrl = URL.createObjectURL(blob);
                        
                        // Detect extension
                        const contentType = response.headers.get('content-type') || '';
                        let extension = 'jpg';
                        if (contentType.includes('video') || url.match(/\.(mp4|webm)/i)) extension = 'mp4';
                        else if (contentType.includes('png') || url.match(/\.png/i)) extension = 'png';
                        else if (contentType.includes('webp') || url.match(/\.webp/i)) extension = 'webp';
                        
                        const link = document.createElement('a');
                        link.href = blobUrl;
                        link.download = 'mugshot_' + generateNanoId(8) + '.' + extension;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        
                        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
                        
                    } catch (err) {
                        console.error('Download fetch error:', err);
                        
                        // Strategy 2: Canvas fallback (Images only)
                        try {
                            const img = document.getElementById('result-final');
                            if (img && img.style.display !== 'none' && img.naturalWidth > 0) {
                                const canvas = document.createElement('canvas');
                                canvas.width = img.naturalWidth;
                                canvas.height = img.naturalHeight;
                                const ctx = canvas.getContext('2d');
                                ctx.drawImage(img, 0, 0);
                                
                                canvas.toBlob((blob) => {
                                    if (blob) {
                                        const link = document.createElement('a');
                                        link.href = URL.createObjectURL(blob);
                                        link.download = 'mugshot_' + generateNanoId(8) + '.png';
                                        link.click();
                                        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
                                    } else {
                                        throw new Error('Canvas blob failed');
                                    }
                                }, 'image/png');
                                return;
                            }
                        } catch (canvasErr) {
                            console.error('Canvas fallback error:', canvasErr);
                        }
                        
                        // Strategy 3: New Tab Fallback
                        alert('Direct download failed. Opening in new tab - please right click and "Save as..."');
                        window.open(url, '_blank');
                    } finally {
                        downloadBtn.textContent = originalText;
                        downloadBtn.classList.remove('disabled');
                    }
                });
            }
        }
    };
    
    // Start App
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => App.init());
    } else {
        App.init();
    }

})();