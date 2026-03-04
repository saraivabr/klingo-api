<?php

namespace App\Livewire;

use App\Models\Doctor;
use Rappasoft\LaravelLivewireTables\DataTableComponent;
use Rappasoft\LaravelLivewireTables\Views\Column;
use App\Models\PatientQueue;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Auth;

class PatientQueueTable extends LivewireTableComponent
{
    protected $model = PatientQueue::class;

    public $showButtonOnHeader = true;

    public $buttonComponent = 'patient_queues.add-button';

    protected $listeners = ['refresh' => '$refresh'];

    public function configure(): void
    {
        $this->setDefaultSort('no', 'desc');
        $this->setQueryStringStatus(false);
        $this->setPrimaryKey('id');
        $this->setQueryStringStatus(false);
    }

    public function columns(): array
    {
        return [
            Column::make("No", "no")
                ->sortable(),
            Column::make(__('messages.case.patient'), 'appointment.patient.patientUser.email')
                ->hideIf('patient.patientUser.email')
                ->searchable(),
            Column::make(__('messages.case.patient'), 'appointment.doctor.doctorUser.email')
                ->hideIf('doctor.doctorUser.email')
                ->searchable(),
            Column::make(__('messages.case.patient'), 'appointment.patient.patientUser.first_name')
                ->view('patient_queues.columns.patient_name')
                ->sortable()
                ->searchable(),
            Column::make(__('messages.case.doctor'), 'appointment.doctor.doctorUser.first_name')
                ->view('patient_queues.columns.doctor_name')
                ->sortable()
                ->searchable(),
            Column::make(__('messages.appointment.date'), 'created_at')
                ->view('patient_queues.columns.date')
                ->sortable(),
            Column::make(__('messages.common.status'), 'appointment.is_completed')
                ->view('patient_queues.columns.status'),
            Column::make(__('messages.common.action'), 'id')
                ->view('patient_queues.columns.action'),
        ];
    }

    public function builder(): Builder
    {
        /** @var Appointment $query */
        if (! getLoggedinDoctor()) {
            if (getLoggedinPatient()) {
                $query = PatientQueue::query()->select('patient_queues.*')->with('appointment');
                $patient = Auth::user();
                $query->whereHas('appointment.patient', function (Builder $query) use ($patient) {
                    $query->where('user_id', '=', $patient->id);
                });
            } else {
                $query = PatientQueue::query()->select('patient_queues.*')->with('appointment');
            }
        } else {
            $doctorId = Doctor::where('user_id', getLoggedInUserId())->first();
            $query = PatientQueue::query()->select('patient_queues.*')->with(
                'appointment'
            )->whereHas('appointment.doctor', function (Builder $query) use ($doctorId) {
                $query->where('doctor_id', '=', $doctorId->id);
            });
        }

        return $query;
    }
}
