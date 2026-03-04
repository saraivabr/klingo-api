function updateTime() {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const date = now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    document.getElementById('clock').textContent = time;
    document.getElementById('date').textContent = date;
}

setInterval(updateTime, 1000);
updateTime();

document.addEventListener("DOMContentLoaded", function () {
    let refreshInterval = 20; // seconds
    let timer = refreshInterval;
    const timerEl = document.getElementById("refresh-timer");

    setInterval(() => {
        timer--;
        timerEl.textContent = timer;

        if (timer <= 0) {
            fetch("/patient-queue-refresh")
                .then(res => res.text())
                .then(html => {
                    document.getElementById("queue-container").innerHTML = html;
                    timer = refreshInterval; // reset timer
                })
                .catch(() => {
                    timer = refreshInterval;
                });
        }
    }, 1000);
});

