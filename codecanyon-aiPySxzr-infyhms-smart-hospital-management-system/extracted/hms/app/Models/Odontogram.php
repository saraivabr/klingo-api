<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Odontogram extends Model
{
    use HasFactory;

    public $table = 'odontograms';

    public $fillable = [
        'odontogram',
        'patient_id',
        'doctor_id',
        'description',
    ];

    protected $casts = [
        'patient_id' => 'integer',
        'doctor_id' => 'integer',
        'description' => 'string',
    ];

    public static $rules = [
        'odontogram' => 'required',
        'patient_id' => 'required',
        'doctor_id' => 'required',
        'description' => 'required',
    ];


    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class, 'patient_id');
    }

    public function doctor(): BelongsTo
    {
        return $this->belongsTo(Doctor::class, 'doctor_id');
    }
}
