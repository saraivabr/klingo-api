document.addEventListener('DOMContentLoaded', loadOdondtogramData)

let color = "#673ab7";
let odontogram = [];
let currentOdontogram = [];

function loadOdondtogramData() {
    if (!$(".addOdontogramForm").length && !$("#editOdontogramForm").length) {
        return false;
    }

    const odontogramPatientIdElement = $("#odontogramPatientId");
    const odontogramDoctorIdElement = $("#odontogramDoctorId");
    const editOdontogramPatientIdElement = $("#editPatientId");
    const editOdontogramDoctorIdElement = $("#editDoctorId");

    if(odontogramPatientIdElement.length){
        $("#odontogramPatientId").select2({
            width: "100%",
            dropdownParent: $("#add_odontogram_modal"),
        });
    }
    
    if(odontogramDoctorIdElement.length){
        $("#odontogramDoctorId").select2({
            width: "100%",
            dropdownParent: $("#add_odontogram_modal"),
        });
    }

    if(editOdontogramPatientIdElement.length){
        $("#editPatientId").select2({
            width: "100%",
            dropdownParent: $("#edit_odontogram_modal"),
        });
    }

    if(editOdontogramDoctorIdElement.length){
        $("#editDoctorId").select2({
            width: "100%",
            dropdownParent: $("#edit_odontogram_modal"),
        });
    }

     // Attach color selection click listeners
     document.querySelectorAll('.clickUl a').forEach(function(el) {
        el.addEventListener('click', function() {
            color = el.getAttribute('data-color');
        });
    });

    document.querySelectorAll('.Spots polygon, .Spots path').forEach(function(el) {
        el.addEventListener('click', function() {
            var key = el.getAttribute('data-key');
            var currentFill = el.getAttribute('fill');
            
            // ✅ Choose the correct hidden input dynamically
            let isEdit = document.querySelector('#edit_odontogram_modal.show') !== null;
            let odontogramInput = isEdit 
                ? document.querySelector('#editOdontogram') 
                : document.querySelector('input[name="odontogram"]');

            let odontogram = currentOdontogram;
    
            if (currentFill === 'white') {
                odontogram.push({ key: key, color: color });
                el.setAttribute('fill', color);
            } else {
                odontogram = odontogram.filter(item => item.key !== key);
                el.setAttribute('fill', 'white');
            }
    
            currentOdontogram = odontogram;
            odontogramInput.value = JSON.stringify(odontogram); // ✅ Write to correct input
        });
    });
    
    
}



listenSubmit('#addOdontogramForm', function (event) {
    event.preventDefault();
    var loadingButton = jQuery(this).find('#btnOdontogramSave');
    loadingButton.button('loading');
    $.ajax({
        url: $('#createOdontogramURL').val(),
        type: 'POST',
        data: $(this).serialize(),
        success: function (result) {
            if (result.success) {
                displaySuccessMessage(result.message);
                $('#add_odontogram_modal').modal('hide');
                Livewire.dispatch('refresh')
            }
        },
        error: function (result) {
            printErrorMessage('#rcvalidationErrorsBox', result);
        },
        complete: function () {
            loadingButton.button('reset');
        },
    });
});

listenSubmit('#editOdontogramForm', function (event) {
    event.preventDefault();
    var loadingButton = jQuery(this).find('#btnOdontogramEditSave');
    loadingButton.button('loading');
    var id = $('#editOdontogramId').val();
    $.ajax({
        url: $('#odontogramURL').val() + '/' + id,
        type: 'patch',
        data: $(this).serialize(),
        success: function (result) {
            if (result.success) {
                displaySuccessMessage(result.message);
                $('#edit_odontogram_modal').modal('hide');
                Livewire.dispatch('refresh')
            }
        },
        error: function (result) {
            UnprocessableInputError(result);
        },
        complete: function () {
            loadingButton.button('reset');
        },
    });
});

listenHiddenBsModal('#add_odontogram_modal', function () {
    resetModalForm('#addOdontogramForm', '#odontogramValidationErrorsBox');
    document.querySelectorAll('.Spots polygon, .Spots path').forEach(function (el) {
        el.setAttribute('fill', 'white');
    });
    document.querySelector('input[name="odontogram"]').value = '';
    currentOdontogram = [];
    $("#odontogramPatientId,#odontogramDoctorId").select2({
        width: "100%",
        dropdownParent: $("#add_odontogram_modal"),
    });

    $("#editPatientId,#editDoctorId").select2({
        width: "100%",
        dropdownParent: $("#edit_odontogram_modal"),
    });

});

listenHiddenBsModal('#edit_odontogram_modal', function () {
    resetModalForm('#editOdontogramForm', '#editOdontogramValidationErrorsBox');
    document.querySelectorAll('.Spots polygon, .Spots path').forEach(function (el) {
        el.setAttribute('fill', 'white');
    });
    currentOdontogram = [];

});

function odontogramRenderData(id) {
    $.ajax({
        url: $('#odontogramURL').val() + '/' + id + '/edit',
        type: 'GET',
        success: function (result) {
            if (result.success) {
                let odontogramData = result.data;
                

                $('#editOdontogramId').val(odontogramData.id);
                $('#editPatientId').val(odontogramData.patient_id).trigger('change');
                $('#editDoctorId').val(odontogramData.doctor_id).trigger('change');
                $('#editDescription').val(odontogramData.description);
                $('#editOdontogram').val(JSON.stringify(odontogramData.odontogram));

                $('.Spots polygon').attr('fill', 'white');

                let odontogramArray = JSON.parse(odontogramData.odontogram);    
                currentOdontogram = odontogramArray;

                $.each(odontogramArray, function(index, value) {

                    $('#editTooth' + value['key']).attr('fill', value['color']);
                });
                $('#edit_odontogram_modal').modal('show');
                ajaxCallCompleted();
                Livewire.dispatch('refresh')
            }
        },
        error: function (result) {
            manageAjaxErrors(result);
        },
    });
}

listenClick('.edit-odontogram-btn', function (event) {
    if ($('.ajaxCallIsRunning').val()) {
        return;
    }
    ajaxCallInProgress();
    let odontogramId = $(event.currentTarget).attr('data-id');
    odontogramRenderData(odontogramId);
});

listenClick('.delete-odontogram-btn', function (event) {
    let odontogramId = $(event.currentTarget).attr('data-id');
    deleteItem($('#odontogramURL').val() + '/' + odontogramId,
        '', "Odontogram");
});
