<?php

namespace App\Http\Controllers;

use App\Models\Appointment;
use App\Models\PatientQueue;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;

class PatientQueueController extends AppBaseController
{
    public function index()
    {
        return view('patient_queues.index');
    }

    public function show()
    {
        $patientQueue = PatientQueue::whereDate('created_at', Carbon::today())->orderBy('no', 'asc')->take(3)->get();

        return view('patient_queues.patient-queue', compact('patientQueue'));
    }

    public function changeStatus(Request $request)
    {
        $appointment = Appointment::find($request->id);
        $appointment->update(['is_completed' => $request->status]);

        $lastQueue = PatientQueue::max('no');
        $nextQueueNo = $lastQueue ? $lastQueue + 1 : 1;

        $input['appointment_id']  = $appointment->id;
        $input['no']  = $nextQueueNo;

        PatientQueue::create($input);

        return $this->sendsuccess(__('messages.common.status_updated_successfully'));
    }

    public function checkOutIn(Request $request)
    {
        $patientQueue = PatientQueue::find($request->id);
        $appointment = Appointment::find($patientQueue->appointment_id);

        if ($request->status == Appointment::STATUS_COMPLETED) {
            $patientQueue->delete();
        }

        $appointment->update([
            'is_completed' => $request->status
        ]);

        return $this->sendsuccess(__('messages.common.status_updated_successfully'));
    }

    public function refresh()
    {
        $patientQueue = PatientQueue::whereDate('created_at', Carbon::today())
            ->orderBy('no', 'asc')
            ->take(3)
            ->get();

        return view('patient_queues.patient_queue_list', compact('patientQueue'));
    }
}
