<?php

namespace App\Repositories;


use App\Models\Doctor;
use App\Models\Odontogram;
use App\Models\Patient;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

/**
 * Class appointmentRepository
 *
 * @version February 13, 2020, 5:52 am UTC
 */
class OdontogramRepository extends BaseRepository
{
    protected $fieldSearchable = [
        'patient_id',
        'doctor_id',
    ];

    public function getFieldsSearchable()
    {
        return $this->fieldSearchable;
    }

    public function model()
    {
        return Odontogram::class;
    }

    public function store($input)
    {
        try {
            $dataArray = json_decode($input['odontogram'], true);
            $input['odontogram'] = json_encode($dataArray);
            $this->create($input);
        } catch (\Exception $e) {
            throw new UnprocessableEntityHttpException($e->getMessage());
        }
    }

    public function updateData($input, $Id)
    {
        try {

            $dataArray = $input['odontogram'];
            while (is_string($dataArray)) {
                $dataArray = json_decode($dataArray, true);
            }
            
            $input['odontogram'] = json_encode($dataArray);
            $this->update($input, $Id);

        } catch (\Exception $e) {
            throw new UnprocessableEntityHttpException($e->getMessage());
        }
    }

    public function getPatients()
    {
        $patients = Patient::with('patientUser')->get()->where('patientUser.status', '=',
            1)->pluck('patientUser.full_name', 'id')->sort();

        return $patients;
    }

    public function getDoctorData()
    {
        $doctors = Doctor::with('doctorUser')->get()->where('doctorUser.status', '=', 1)->pluck('doctorUser.full_name', 'id')->sort();

        return $doctors;
    }

}
