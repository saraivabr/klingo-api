<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ __('messages.queue.patient_queue_system') }}</title>
    <link href="{{ mix('assets/css/queue.css') }}" rel="stylesheet" type="text/css" />
</head>
<body>
    <header class="header">
        <div class="hospital-info">
            <div class="logo">
                <a  href="{{ url('/') }}" data-toggle="tooltip" data-placement="right"
                    class="text-decoration-none sidebar-logo" title="{{ getAppName() }}" target="_blank">
                    <img src="{{ asset(getSettingValue()['app_logo']['value']) }}" alt="Logo" width="50px" height="50px"
                        class="image" />
                </a>
            </div>
            <div>
                <h2>{{ getAppName() }}</h2>
                <p>{{ __('messages.queue.patient_queue_system') }}</p>
            </div>
        </div>
        <div class="time-info">
            <h3 id="clock">--:-- --</h3>
            <p id="date"></p>
            <span class="live-dot"></span> {{ __('messages.queue.live_updates') }}
        </div>
    </header>

    <div class="legend" style="display: flex; justify-content: space-between; align-items: center;">
        <div>
            <span><span class="dot green"></span> {{ __('messages.queue.currently_serving') }}</span>
            <span style="margin-left: 15px;"><span class="dot yellow"></span>  {{ __('messages.queue.waiting') }}</span>
        </div>
    
        <div class="refresh-div">
            {{ __('messages.queue.auto_refresh') }}: <span id="refresh-timer">20</span><span class="second">s</span>
            <span id="refresh-loader" class="loader"></span>
        </div>
    </div>
    
    <div id="queue-container">
        @include('patient_queues.patient_queue_list', ['patientQueue' => $patientQueue])
    </div>

    <script src="{{ asset('assets/js/queue.js') }}"></script>
</body>
</html>
