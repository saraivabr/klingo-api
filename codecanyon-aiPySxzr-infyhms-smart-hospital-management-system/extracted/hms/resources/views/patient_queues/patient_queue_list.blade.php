<div class="queue-table">
    <div class="queue-header">
        <div># {{ __('messages.queue.queue') }}</div>
        <div>{{ __('messages.queue.patient_name') }}</div>
        <div>{{ __('messages.queue.attending_doctors') }}</div>
        <div>{{ __('messages.queue.status') }}</div>
    </div>
    @forelse ($patientQueue as $queue)
      <div class="queue-row  {!! ($queue->appointment->is_completed == App\Models\Appointment::STATUS_CHECK_IN) ? 'active' : '' !!}">
        <div>{{ $queue->no }}</div>
        <div>
            <strong>{{ $queue->appointment->patient->patientUser->full_name }}</strong>
        </div>
        <div>
            <strong>{{ $queue->appointment->doctor->doctorUser->full_name }}</strong>
            <p>{{ $queue->appointment->doctor->department->title ?? '' }}</p>
        </div>
        <div>
            {!! ($queue->appointment->is_completed == App\Models\Appointment::STATUS_IN_QUEUE) 
                ? '<span class="dot yellow"></span>' 
                : '<span class="dot green"></span>' !!}
        </div>
      </div>
    @empty
        <div class="queue-row-empty">
            {{ __('messages.queue.no_patients_in_queue') }}
        </div>
    @endforelse
   
</div>
