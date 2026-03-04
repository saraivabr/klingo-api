<?php

namespace App\Livewire;

use App\Models\Doctor;
use App\Models\Odontogram;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Auth;
use Livewire\WithPagination;
use Rappasoft\LaravelLivewireTables\Views\Column;
use Livewire\Attributes\Lazy;

#[Lazy]
class OdontogramTable extends LivewireTableComponent
{
    protected $model = Odontogram::class;

    use WithPagination;

    public $showButtonOnHeader = true;

    public $showFilterOnHeader = false;

    public $paginationIsEnabled = true;

    public $buttonComponent = 'odontogram.add-button';

    protected $listeners = ['refresh' => '$refresh', 'changeFilter', 'resetPage'];

    public function placeholder()
    {
        return view('livewire.skeleton_files.common_skeleton');
    }

    public function configure(): void
    {
        $this->setPrimaryKey('id')
            ->setDefaultSort('created_at', 'desc');

        $this->setThAttributes(function (Column $column) {
            if ($column->isField('id')) {
                return [
                    'class' => 'd-flex justify-content-end ps-125 text-center',
                    'style' => 'width:75%',

                ];
            }

            return [];
        });
    }

    public function columns(): array
    {
        return [

            Column::make(__('messages.case.patient'), 'patient.patientUser.first_name')
                ->view('appointments.templates.columns.patient_name')
                ->sortable()
                ->searchable(),
            Column::make(__('messages.case.doctor'), 'doctor.doctorUser.first_name')
                ->view('appointments.templates.columns.doctor_name')
                ->sortable()
                ->searchable(),
            Column::make(__('messages.common.action'), 'id')->view('odontogram.action'),
            Column::make('created_at')->sortable()->hideIf(1),
        ];
    }

    public function builder(): Builder
    {
        if (! getLoggedinDoctor()) {
            if (getLoggedinPatient()) {
                $query = Odontogram::query()->select('odontograms.*')->with('patient', 'doctor');
                $patient = Auth::user();
                $query->whereHas('patient', function (Builder $query) use ($patient) {
                    $query->where('user_id', '=', $patient->id);
                });
            } else {
                $query = Odontogram::query()->select('odontograms.*')->with('patient', 'doctor');
            }
        } else {
            $doctorId = Doctor::where('user_id', getLoggedInUserId())->first();
            $query = Odontogram::query()->select('odontograms.*')->with('patient', 'doctor')->where('doctor_id', $doctorId->id);
        }

        return $query;
    }
}
