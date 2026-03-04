listen('click', '.deleteOpdPatientBtn', function (event) {
    let opdPatientsId = $(event.currentTarget).attr("data-id");
    deleteItem($('#indexOpdPatientUrl').val() + '/' + opdPatientsId, null,
        $('#Receptionist').val())
});

