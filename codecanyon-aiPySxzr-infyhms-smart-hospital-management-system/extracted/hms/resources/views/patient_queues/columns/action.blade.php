<div class="d-flex align-items-center">
    @if (!Auth::user()->hasRole('Patient'))
        @if($row->appointment->is_completed != App\Models\Appointment::STATUS_CHECK_IN)
            <a data-bs-toggle="tooltip" data-placement="top" data-bs-original-title="{{ __('Check In') }}"
                data-id="{{ $row->id }}" data-val="5"
                class="patient-queue-status btn px-1 text-primary fs-3 pe-0">
                <i class="fas fa-right-from-bracket text-primary"></i>
            </a>
        @endif
        <a data-bs-toggle="tooltip" data-placement="top" data-bs-original-title="{{ __('Check Out') }}" data-id="{{ $row->id }}" data-val="1"
            class="patient-queue-status btn px-1 text-danger fs-3 pe-0">
            <i class="fas fa-right-from-bracket fa-flip-horizontal text-danger"></i>
        </a>
    @endif
</div>
