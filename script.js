document.getElementById("employeeForm").addEventListener("submit", function(e){
    e.preventDefault();

    const name = document.getElementById("empName").value;
    const trade = document.getElementById("trade").value;
    const exp = document.getElementById("experience").value;
    const tools = document.getElementById("tools").value;
    const ppe = document.getElementById("ppe").value;
    const tier = document.getElementById("safetyTier").value;

    const result = `
        Employee: ${name}
        Trade: ${trade}
        Experience: ${exp} years
        Tools: ${tools}
        PPE: ${ppe}
        Safety Tier: ${tier}
    `;

    alert("Employee filtered:\n\n" + result);
});
