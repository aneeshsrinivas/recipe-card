document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const darkModeBtn = document.getElementById('dark-mode-btn');
    const printBtn = document.getElementById('print-btn');
    const startCookingBtn = document.getElementById('start-cooking-btn');
    const voiceControlBtn = document.getElementById('voice-control-btn');
    const timerBtn = document.getElementById('timer-btn');
    const servingSelector = document.getElementById('servings');
    const unitToggle = document.getElementById('unit-toggle');
    const xpBar = document.getElementById('xp-bar');
    const xpValue = document.getElementById('xp-value');
    const chefLevel = document.getElementById('chef-level');
    const modal = document.getElementById('timer-modal');
    const closeBtn = document.querySelector('.close');
    const startTimerBtn = document.getElementById('start-timer');
    const resetTimerBtn = document.getElementById('reset-timer');
    const timerDisplay = document.getElementById('timer-display');
    const steps = document.querySelectorAll('.instructions-list li');
    
    // State variables
    let xp = parseInt(localStorage.getItem('chefXP')) || 0;
    let isVoiceActive = false;
    let recognition;
    let currentStep = 0;
    let timerInterval;
    let timeLeft = 0;
    let isMetric = false;
    const baseServings = 8;
    
    // Initialize
    updateXPDisplay();
    loadDarkModePreference();
    setupServingSelector();
    setupCheckboxes();
    
    // Dark Mode Toggle
    darkModeBtn.addEventListener('click', toggleDarkMode);
    
    function toggleDarkMode() {
        document.body.classList.toggle('dark-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');
        localStorage.setItem('darkMode', isDarkMode);
        darkModeBtn.textContent = isDarkMode ? 'Light Mode' : 'Dark Mode';
    }
    
    // Print Button
    printBtn.addEventListener('click', function() {
        window.print();
    });
    
    // Serving Selector
    function setupServingSelector() {
        servingSelector.addEventListener('change', adjustServings);
        adjustServings(); // Initialize with default servings
    }
    
    function adjustServings() {
        const selectedServings = parseInt(servingSelector.value);
        
        document.querySelectorAll('[data-base-amount]').forEach(ingredient => {
            const baseAmount = parseFloat(ingredient.dataset.baseAmount);
            const adjustedAmount = (baseAmount * selectedServings / baseServings).toFixed(2);
            
            // Format the display
            let displayAmount;
            if (adjustedAmount % 1 === 0) {
                displayAmount = parseInt(adjustedAmount);
            } else if (adjustedAmount % 0.5 === 0) {
                displayAmount = adjustedAmount.replace('.5', '½');
            } else if (adjustedAmount % 0.25 === 0) {
                displayAmount = adjustedAmount.replace('.25', '¼');
            } else if (adjustedAmount % 0.75 === 0) {
                displayAmount = adjustedAmount.replace('.75', '¾');
            } else {
                displayAmount = adjustedAmount;
            }
            
            // Preserve the rest of the text
            const originalText = ingredient.textContent;
            const unitMatch = originalText.match(/(cup|tsp|tbsp|oz|g|ml)/);
            const unit = unitMatch ? unitMatch[0] : '';
            const restOfText = originalText.replace(/^[\d¼½¾.]+/, '').trim();
            
            ingredient.textContent = `${displayAmount} ${unit} ${restOfText}`;
        });
    }
    
    // Unit Conversion
    unitToggle.addEventListener('click', toggleUnits);
    
    function toggleUnits() {
        isMetric = !isMetric;
        unitToggle.textContent = isMetric ? 'Imperial' : 'Metric';
        convertUnits(isMetric);
    }
    
    function convertUnits(toMetric) {
        document.querySelectorAll('[data-base-amount]').forEach(ingredient => {
            const text = ingredient.textContent;
            
            if (toMetric) {
                // Convert cups to grams/ml
                if (text.includes('cup')) {
                    if (text.includes('flour') || text.includes('sugar')) {
                        ingredient.textContent = text.replace(/([\d¼½¾.]+) cup/, (match, amount) => {
                            const cups = parseFraction(amount);
                            return `${Math.round(cups * 120)}g`;
                        });
                    } else if (text.includes('butter')) {
                        ingredient.textContent = text.replace(/([\d¼½¾.]+) cup/, (match, amount) => {
                            const cups = parseFraction(amount);
                            return `${Math.round(cups * 225)}g`;
                        });
                    } else {
                        // For liquids
                        ingredient.textContent = text.replace(/([\d¼½¾.]+) cup/, (match, amount) => {
                            const cups = parseFraction(amount);
                            return `${Math.round(cups * 240)}ml`;
                        });
                    }
                } else if (text.includes('tsp') || text.includes('tbsp')) {
                    ingredient.textContent = text.replace(/([\d¼½¾.]+) (tsp|tbsp)/, (match, amount, unit) => {
                        const quantity = parseFraction(amount);
                        const ml = unit === 'tsp' ? quantity * 5 : quantity * 15;
                        return `${Math.round(ml)}ml`;
                    });
                }
                
                // Update temperature display
                document.querySelectorAll('li').forEach(li => {
                    li.textContent = li.textContent.replace('350°F', '175°C')
                                                  .replace('340°F', '170°C');
                });
            } else {
                // Convert back to imperial (simplified)
                // This would need more comprehensive conversion logic
                alert("Imperial conversion would go here");
            }
        });
    }
    
    function parseFraction(string) {
        if (string.includes('¼')) return parseFloat(string) + 0.25;
        if (string.includes('½')) return parseFloat(string) + 0.5;
        if (string.includes('¾')) return parseFloat(string) + 0.75;
        return parseFloat(string);
    }
    
    // Ingredient Checklist
    function setupCheckboxes() {
        const checkboxes = document.querySelectorAll('.ingredient-check');
        checkboxes.forEach(checkbox => {
            // Load checked state from localStorage
            const ingredientId = checkbox.parentElement.textContent.trim();
            if (localStorage.getItem(`ingredient_${ingredientId}`) === 'checked') {
                checkbox.checked = true;
                checkbox.nextElementSibling.style.textDecoration = 'line-through';
                checkbox.nextElementSibling.style.color = '#888';
            }
            
            checkbox.addEventListener('change', function() {
                const ingredientId = this.parentElement.textContent.trim();
                if (this.checked) {
                    localStorage.setItem(`ingredient_${ingredientId}`, 'checked');
                    addXP(2); // Small XP reward for each ingredient prepped
                } else {
                    localStorage.removeItem(`ingredient_${ingredientId}`);
                }
            });
        });
    }
    
    // Voice Control
    voiceControlBtn.addEventListener('click', toggleVoiceControl);
    
    function toggleVoiceControl() {
        if (isVoiceActive) {
            stopVoiceControl();
        } else {
            startVoiceControl();
        }
    }
    
    function startVoiceControl() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = false;
            
            recognition.onresult = function(event) {
                const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase();
                
                if (transcript.includes('next step')) {
                    goToNextStep();
                } else if (transcript.includes('repeat')) {
                    readCurrentStep();
                } else if (transcript.includes('stop')) {
                    stopVoiceControl();
                } else if (transcript.includes('start timer')) {
                    startTimer();
                }
            };
            
            recognition.onerror = function(event) {
                console.error('Voice recognition error', event.error);
                stopVoiceControl();
            };
            
            recognition.start();
            isVoiceActive = true;
            voiceControlBtn.classList.add('active');
            voiceControlBtn.innerHTML = '<img src="https://cdn-icons-png.flaticon.com/512/337/337946.png" alt="" width="16"> Listening...';
        } else {
            alert("Voice control not supported in your browser. Try Chrome or Edge.");
        }
    }
    
    function stopVoiceControl() {
        if (recognition) {
            recognition.stop();
        }
        isVoiceActive = false;
        voiceControlBtn.classList.remove('active');
        voiceControlBtn.innerHTML = '<img src="https://cdn-icons-png.flaticon.com/512/337/337946.png" alt="" width="16"> Voice';
    }
    
    // Cooking Steps
    function goToNextStep() {
        if (currentStep < steps.length - 1) {
            steps[currentStep].classList.remove('active-step');
            currentStep++;
            steps[currentStep].classList.add('active-step');
            addXP(5);
            
            // Auto-start timer if step has time data
            const stepTime = steps[currentStep].getAttribute('data-time');
            if (stepTime && !timerInterval) {
                timeLeft = parseInt(stepTime) * 60;
                updateTimerDisplay();
                startTimer();
            }
        }
    }
    
    function readCurrentStep() {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(steps[currentStep].textContent);
            window.speechSynthesis.speak(utterance);
        }
    }
    
    // XP System
    function addXP(points) {
        xp = Math.min(xp + points, 100);
        
        // Check for level up
        const newLevel = Math.floor(xp / 100) + 1;
        if (newLevel > parseInt(chefLevel.textContent)) {
            chefLevel.textContent = newLevel;
            showXPMessage(`Level Up! Now Level ${newLevel} Chef!`);
        }
        
        localStorage.setItem('chefXP', xp);
        updateXPDisplay();
    }
    
    function updateXPDisplay() {
        document.documentElement.style.setProperty('--xp-width', `${xp}%`);
        xpValue.textContent = xp;
    }
    
    function showXPMessage(message) {
        const xpMsg = document.createElement('div');
        xpMsg.className = 'xp-message';
        xpMsg.textContent = message;
        xpMsg.style.position = 'fixed';
        xpMsg.style.bottom = '20px';
        xpMsg.style.left = '50%';
        xpMsg.style.transform = 'translateX(-50%)';
        xpMsg.style.backgroundColor = 'var(--primary)';
        xpMsg.style.color = 'white';
        xpMsg.style.padding = '10px 20px';
        xpMsg.style.borderRadius = '20px';
        xpMsg.style.zIndex = '1000';
        xpMsg.style.animation = 'fadeInOut 3s forwards';
        
        document.body.appendChild(xpMsg);
        
        setTimeout(() => {
            xpMsg.remove();
        }, 3000);
    }
    
    // Start Cooking
    startCookingBtn.addEventListener('click', function() {
        addXP(10);
        steps[0].classList.add('active-step');
        currentStep = 0;
        showXPMessage("+10 XP for starting to cook!");
    });
    
    // Timer System
    timerBtn.addEventListener('click', function() {
        modal.style.display = 'block';
    });
    
    closeBtn.addEventListener('click', function() {
        modal.style.display = 'none';
    });
    
    startTimerBtn.addEventListener('click', startTimer);
    
    function startTimer() {
        // If no specific time left, use cook time from recipe
        if (timeLeft <= 0) {
            const cookTime = parseInt(document.querySelector('.info-value:nth-child(2)').textContent);
            timeLeft = cookTime * 60;
        }
        
        if (timerInterval) clearInterval(timerInterval);
        
        timerInterval = setInterval(function() {
            timeLeft--;
            updateTimerDisplay();
            
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                alert("Time's up! Check your cake!");
                addXP(5);
            }
        }, 1000);
    }
    
    resetTimerBtn.addEventListener('click', function() {
        clearInterval(timerInterval);
        timeLeft = 0;
        updateTimerDisplay();
    });
    
    function updateTimerDisplay() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    // Load dark mode preference
    function loadDarkModePreference() {
        if (localStorage.getItem('darkMode') === 'true') {
            document.body.classList.add('dark-mode');
            darkModeBtn.textContent = 'Light Mode';
        }
    }
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    // Add animation for XP messages
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeInOut {
            0% { opacity: 0; transform: translateX(-50%) translateY(20px); }
            20% { opacity: 1; transform: translateX(-50%) translateY(0); }
            80% { opacity: 1; transform: translateX(-50%) translateY(0); }
            100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        }
    `;
    document.head.appendChild(style);
});