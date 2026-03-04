<?php

namespace App\Http\Controllers;

use App\Http\Requests\CreateOdontogramRequest;
use App\Http\Requests\UpdateOdontogramRequest;
use App\Models\Odontogram;
use App\Models\Setting;
use Illuminate\Http\Request;
use App\Repositories\OdontogramRepository;
use Barryvdh\DomPDF\Facade\Pdf as FacadePdf;
use Barryvdh\DomPDF\PDF;

class OdontogramController extends AppBaseController
{
    /** @var OdontogramRepository */
    private $odontogramRepository;

    public function __construct(OdontogramRepository $odontogramRepo)
    {
        $this->odontogramRepository = $odontogramRepo;
    }

    public function index()
    {
        $patients = $this->odontogramRepository->getPatients();
        $doctors = $this->odontogramRepository->getDoctorData();

        return view('odontogram.index', compact('patients', 'doctors'));
    }

    public function store(CreateOdontogramRequest $request)
    {
        $input = $request->all();
        $this->odontogramRepository->store($input);

        return $this->sendSuccess(__('Odontogram Created Successfully.'));
    }

    public function edit(Odontogram $odontogram)
    {
        return $this->sendResponse($odontogram, 'Odontogram retrieved successfully.');
    }

    public function update(UpdateOdontogramRequest $request, Odontogram $odontogram)
    {
        $this->odontogramRepository->updateData($request->all(), $odontogram->id);

        return $this->sendSuccess(__('Odontogram Updated Successfully.'));
    }

    public function destroy(Odontogram $odontogram)
    {

        $odontogram->delete();

        return $this->sendSuccess(__('Odontogram Deleted Successfully.'));
    }
    public function convertToPdf(Odontogram $odontogram)
    {
        $data = [];
        $data['setting'] = Setting::all()->pluck('value', 'key')->toArray();

        $data['odontogram'] = $odontogram;
        $pdf = FacadePdf::loadView('odontogram.pdf', $data);

        return $pdf->stream('odontogram.pdf');

    }
}
